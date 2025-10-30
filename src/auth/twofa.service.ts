import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as otplib from 'otplib';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import { users, verificationTokens } from '@app/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';

@Injectable()
export class TwofaService {
  private readonly issuer: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly config: ConfigService,
  ) {
    this.issuer = this.config.get<string>('APP_NAME') || 'BookingApp';

    otplib.authenticator.options = {
      step: 30,
      window: [1, 1],
    };
  }

  async beginSetup(userId: string) {
    const secret = otplib.authenticator.generateSecret();

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.db.insert(verificationTokens).values({
      userId,
      type: 'TOTP_SETUP',
      tokenHash: `pending:${userId}`,
      meta: JSON.stringify({ secret }),
      expiresAt,
      createdAt: new Date(),
    });

    const label = `${this.issuer}:${userId}`;
    const otpauth = otplib.authenticator.keyuri(label, this.issuer, secret);

    return { otpauth };
  }

  async confirmSetup(userId: string, token: string) {
    const now = new Date();

    const pending = await this.db.query.verificationTokens.findFirst({
      where: (t, { and, eq, gt }) =>
        and(
          eq(t.userId, userId),
          eq(t.type, 'TOTP_SETUP'),
          gt(t.expiresAt, now),
          isNull(t.usedAt),
        ),
    });

    if (!pending?.meta)
      return { ok: false as const, reason: 'no_pending_setup' };

    let secret: string | undefined;
    try {
      const meta = JSON.parse(pending.meta);
      secret = meta?.secret;
    } catch {
      return { ok: false as const, reason: 'invalid_pending_setup' };
    }
    if (!secret) return { ok: false as const, reason: 'invalid_pending_setup' };

    const valid = otplib.authenticator.check(token, secret);
    if (!valid) return { ok: false as const, reason: 'invalid_token' };

    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ twoFactorSecret: secret, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await tx
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.userId, userId),
            eq(verificationTokens.type, 'TOTP_SETUP'),
          ),
        );
    });

    return { ok: true as const };
  }

  async verify(userId: string, token: string) {
    const u = await this.db.query.users.findFirst({
      where: (t, { eq }) => eq(t.id, userId),
      columns: { twoFactorSecret: true },
    });
    if (!u?.twoFactorSecret) return false;

    return otplib.authenticator.check(token, u.twoFactorSecret);
  }

  async disable(userId: string) {
    await this.db
      .update(users)
      .set({ twoFactorSecret: null, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await this.db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.type, 'TOTP_SETUP'),
        ),
      );

    return { ok: true as const };
  }
}
