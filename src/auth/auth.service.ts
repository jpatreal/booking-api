import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { TokensService } from './tokens.service';
import { MailerService } from './mailer.service';
import { randomToken, sha256Base64 } from '../common/utils/crypto.util';
import { generateUniqueSlug } from '@app/common/utils/slug.util';
import {
  renderResetPasswordTemplate,
  renderVerifyEmailTemplate,
} from './mailer/templates';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';

import {
  users,
  businesses,
  memberships,
  verificationTokens,
  roleEnum,
  verificationType as verificationTypeEnum,
  signupKeys,
} from '@app/db/schema';
import { and, eq, gt } from 'drizzle-orm';

import { AppError } from '@app/common/errors/app.error';
import { ErrorCode } from '@app/common/errors/error-codes';
import {
  ConflictAppError,
  NotFoundAppError,
  UnauthorizedAppError,
} from '@app/common/errors/specialized.errors';
import { HttpStatus } from '@nestjs/common';
import { assertUserEnabled } from '@app/common/utils/tenant.util';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type Role = (typeof roleEnum.enumValues)[number];
type VerificationType = (typeof verificationTypeEnum.enumValues)[number];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly config: ConfigService,
    private readonly tokens: TokensService,
    private readonly mailer: MailerService,
  ) {}

  async register(
    email: string,
    password: string,
    businessName: string,
    registrationKey: string,
  ) {
    const normalizedEmail = normalizeEmail(email);
    if (!registrationKey) {
      throw new AppError('Registration key is required');
    }
    const keyHash = sha256Base64(registrationKey);
    const now = new Date();

    const key = await this.db.query.signupKeys.findFirst({
      where: (t, { eq, or, isNull, gt, and }) =>
        and(
          eq(t.codeHash, keyHash),
          or(isNull(t.expiresAt), gt(t.expiresAt, now)),
        ),
    });
    if (!key)
      throw new UnauthorizedAppError('Invalid or expired registration key');

    if (key.emailDomain && !normalizedEmail.endsWith(`@${key.emailDomain}`)) {
      throw new UnauthorizedAppError(
        'This key is restricted to a specific email domain',
      );
    }

    if (key.maxUses !== null && key.usedCount >= key.maxUses) {
      throw new UnauthorizedAppError('Registration key usage limit reached');
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const result = await this.db.transaction(async (tx) => {
      const existing = await tx.query.users.findFirst({
        where: (t, { eq }) => eq(t.email, normalizedEmail),
      });
      if (existing)
        throw new ConflictAppError('Email already registered', {
          email: normalizedEmail,
        });

      const [user] = await tx
        .insert(users)
        .values({ email: normalizedEmail, passwordHash })
        .returning();

      const slug = await generateUniqueSlug(tx, businesses, businessName);
      const trialDays = key.trialDays ?? 14;
      const trialEndsAt = new Date(
        Date.now() + trialDays * 24 * 60 * 60 * 1000,
      );

      const [biz] = await tx
        .insert(businesses)
        .values({
          name: businessName,
          slug,
          plan: key.plan,
          status: 'trialing',
          trialEndsAt,
          limitsJson:
            key.plan === 'TEST'
              ? JSON.stringify({ staff: 2, services: 5 })
              : key.plan === 'FREE'
                ? JSON.stringify({ staff: 3, services: 10 })
                : null,
        })
        .returning();

      await tx
        .insert(memberships)
        .values({ userId: user.id, businessId: biz.id, role: 'OWNER' });

      await tx
        .update(signupKeys)
        .set({ usedCount: (key.usedCount ?? 0) + 1, updatedAt: new Date() })
        .where(eq(signupKeys.id, key.id));

      return { user, biz };
    });

    try {
      await this.sendVerificationEmail(result.user.id, normalizedEmail);
    } catch (e) {
      this.logger.warn(
        'Failed to send verification email after registration',
        e,
      );
    }

    return result;
  }

  async validateLocalUser(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);

    const user = await this.db.query.users.findFirst({
      where: (t, { eq }) => eq(t.email, normalizedEmail),
    });
    if (!user?.passwordHash) return null;

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) return null;

    return user;
  }

  async issueAuthPair(
    userId: string,
    membership?: { id: string; biz: string; role: string },
    req?: any,
  ) {
    await assertUserEnabled(this.db, userId);
    const u = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!u?.[0]?.email) {
      throw new NotFoundAppError('User not found', { userId });
    }

    const email = u[0].email;

    const payload = { sub: userId, email, mb: membership || null };
    const accessToken = await this.tokens.issueAccess(payload);

    const { rawToken, session } = await this.tokens.createSession(userId, {
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });

    return { session, accessToken, refresh: rawToken };
  }

  async refreshByCookie(raw: string, userId: string, req?: any) {
    await assertUserEnabled(this.db, userId);
    const rotated = await this.tokens.rotateSession(raw, userId, {
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
    if (!rotated.valid) {
      throw new UnauthorizedAppError('Invalid refresh token', {
        hint: 'The refresh token may be expired, revoked, or does not belong to this user.',
      });
    }

    const u = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!u?.[0]?.email) {
      throw new NotFoundAppError('User not found', { userId });
    }

    const email = u[0].email;

    const accessToken = await this.tokens.issueAccess({
      sub: userId,
      email,
    });

    return { accessToken, refresh: rotated.next.rawToken };
  }

  async logout(raw: string) {
    try {
      await this.tokens.revokeByRaw(raw);
    } catch (e) {
      throw new AppError('Failed to logout', {
        code: ErrorCode.INTERNAL_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        cause: e,
      });
    }
  }

  async createVerificationToken(userId: string, type: VerificationType) {
    const raw = randomToken(48);
    const hash = sha256Base64(raw);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await this.db.insert(verificationTokens).values({
      userId,
      type,
      tokenHash: hash,
      expiresAt,
      createdAt: new Date(),
    });

    return raw;
  }

  async consumeVerificationToken(raw: string, type: VerificationType) {
    const hash = sha256Base64(raw);
    const now = new Date();

    const tok = await this.db.query.verificationTokens.findFirst({
      where: (t, { and, eq, gt }) =>
        and(eq(t.tokenHash, hash), eq(t.type, type), gt(t.expiresAt, now)),
    });

    if (!tok) {
      throw new UnauthorizedAppError('Invalid or expired token', {
        type,
      });
    }

    await this.db
      .delete(verificationTokens)
      .where(eq(verificationTokens.id, tok.id));

    return tok.userId!;
  }

  async sendVerificationEmail(userId: string, email: string) {
    const token = await this.createVerificationToken(userId, 'EMAIL_VERIFY');
    const url = `${this.config.get('APP_URL')}/verify-email?token=${token}`;

    try {
      await this.mailer.sendMail(
        email,
        'Verify your email',
        renderVerifyEmailTemplate({ link: url }),
      );
    } catch (e) {
      throw new AppError('Failed to send verification email', {
        code: ErrorCode.MAIL_DELIVERY_FAILED,
        status: HttpStatus.BAD_GATEWAY,
        details: { provider: 'smtp', recipient: email },
        cause: e,
      });
    }
  }

  async sendPasswordReset(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const u = await this.db.query.users.findFirst({
      where: (t, { eq }) => eq(t.email, normalizedEmail),
    });

    if (!u) return;

    const token = await this.createVerificationToken(u.id, 'PASSWORD_RESET');
    const url = `${this.config.get('APP_URL')}/reset-password?token=${token}`;

    try {
      await this.mailer.sendMail(
        normalizedEmail,
        'Reset your password',
        renderResetPasswordTemplate({ link: url }),
      );
    } catch (e) {
      throw new AppError('Failed to send password reset email', {
        code: ErrorCode.MAIL_DELIVERY_FAILED,
        status: HttpStatus.BAD_GATEWAY,
        details: { provider: 'smtp', recipient: normalizedEmail },
        cause: e,
      });
    }
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const userId = await this.consumeVerificationToken(
      rawToken,
      'PASSWORD_RESET',
    );

    if (!newPassword) {
      throw new AppError('Password is required', {
        code: ErrorCode.VALIDATION_FAILED,
        status: HttpStatus.BAD_REQUEST,
        details: { field: 'newPassword' },
      });
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });

    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async verifyEmail(rawToken: string) {
    const userId = await this.consumeVerificationToken(
      rawToken,
      'EMAIL_VERIFY',
    );
    await this.db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}
