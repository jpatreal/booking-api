import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addHours } from 'date-fns';

import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';

import { roleEnum } from '@app/db/schema';
import { randomToken, sha256Base64 } from '@app/common/utils/crypto.util';
// import { MembershipsService } from './memberships.service';
// import { MailerService } from '@app/auth/mailer.service';

import { MembershipInviteRepository } from './membership-invite.repository';
import {
  ConflictAppError,
  NotFoundAppError,
} from '@app/common/errors/specialized.errors';

type Role = (typeof roleEnum.enumValues)[number];

interface CreateInviteInput {
  businessId: string;
  email: string;
  role: Role;
  ttlHours?: number;
  returnTokenForDev?: boolean;
}

interface ResendInviteInput {
  inviteId: string;
  ttlHours?: number;
  returnTokenForDev?: boolean;
}

@Injectable()
export class MembershipInviteService {
  private readonly defaultTtlHours = 24 * 7;
  private readonly appBaseUrl: string;
  private readonly logger = new Logger(MembershipInviteService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly config: ConfigService,
    private readonly repo: MembershipInviteRepository,
    // private readonly memberships: MembershipsService,
    // private readonly mailer: MailerService,
  ) {
    this.appBaseUrl =
      this.config.get<string>('app.webBaseUrl')?.replace(/\/+$/, '') ||
      'http://localhost:5173';
  }

  async createInvite(input: CreateInviteInput) {
    const email = input.email.trim().toLowerCase();
    const ttl = input.ttlHours ?? this.defaultTtlHours;
    const now = new Date();

    const business = await this.repo.getBusinessById(input.businessId);
    if (!business) throw new NotFoundAppError('Business not found');

    const existingMember = await this.repo.findExistingMemberByBusinessEmail(
      input.businessId,
      email,
    );
    if (existingMember) {
      throw new ConflictAppError('User is already a member of this business');
    }

    const pending = await this.repo.findActiveInviteByEmail(
      input.businessId,
      email,
      now,
    );
    if (pending) await this.repo.expireInviteNow(pending.id, now);

    const rawToken = randomToken(48);
    const tokenHash = sha256Base64(rawToken);
    const expiresAt = addHours(now, ttl);

    const invite = await this.repo.insertInvite({
      businessId: input.businessId,
      email,
      role: input.role,
      tokenHash,
      expiresAt,
    });

    const link = this.buildAcceptUrl(rawToken);
    await this.sendInviteEmail({
      to: email,
      businessName: business.name,
      role: input.role,
      link,
      expiresAt,
    });

    return {
      id: invite.id,
      businessId: invite.businessId,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      token: input.returnTokenForDev ? rawToken : undefined,
    };
  }

  async resendInvite(input: ResendInviteInput) {
    const now = new Date();
    const ttl = input.ttlHours ?? this.defaultTtlHours;

    const invite = await this.repo.getInviteById(input.inviteId);
    if (!invite) throw new NotFoundAppError('Invite not found');
    if (invite.acceptedAt)
      throw new BadRequestException('Invite already accepted');
    if (invite.expiresAt <= now)
      throw new BadRequestException('Invite is expired, create a new one');

    const rawToken = randomToken(48);
    const tokenHash = sha256Base64(rawToken);
    const expiresAt = addHours(now, ttl);

    const updated = await this.repo.rotateInviteTokenAndExpiry(
      invite.id,
      tokenHash,
      expiresAt,
    );
    if (!updated) throw new NotFoundAppError('Invite not found');

    const business = await this.repo.getBusinessById(updated.businessId);
    const link = this.buildAcceptUrl(rawToken);
    await this.sendInviteEmail({
      to: updated.email,
      businessName: business?.name ?? 'Your Business',
      role: updated.role,
      link,
      expiresAt: updated.expiresAt,
    });

    return {
      id: updated.id,
      businessId: updated.businessId,
      email: updated.email,
      role: updated.role,
      expiresAt: updated.expiresAt,
      acceptedAt: updated.acceptedAt,
      token: input.returnTokenForDev ? rawToken : undefined,
    };
  }

  async cancelInvite(inviteId: string) {
    const now = new Date();
    const invite = await this.repo.getInviteById(inviteId);
    if (!invite) throw new NotFoundAppError('Invite not found');
    if (invite.acceptedAt)
      throw new BadRequestException('Invite already accepted');

    const updated = await this.repo.expireInviteNow(invite.id, now);
    return updated;
  }

  async verifyToken(rawToken: string) {
    const now = new Date();
    const tokenHash = sha256Base64(rawToken);

    const invite = await this.repo.getInviteByTokenHash(tokenHash, this.db);
    if (!invite) throw new NotFoundAppError('Invite not found');
    if (invite.acceptedAt)
      throw new BadRequestException('Invite already accepted');
    if (invite.expiresAt <= now)
      throw new BadRequestException('Invite expired');

    return invite;
  }

  async acceptWithToken(rawToken: string, userId: string) {
    const now = new Date();
    const tokenHash = sha256Base64(rawToken);

    return this.db.transaction(async (tx) => {
      const invite = await this.repo.getInviteByTokenHash(tokenHash, tx);
      if (!invite) throw new NotFoundAppError('Invite not found');
      if (invite.acceptedAt)
        throw new BadRequestException('Invite already accepted');
      if (invite.expiresAt <= now)
        throw new BadRequestException('Invite expired');

      const user = await this.repo.getUserById(userId, tx);
      if (!user) throw new NotFoundAppError('User not found for acceptance');

      const already = await this.repo.findMembershipByBusinessAndUser(
        invite.businessId,
        userId,
        tx,
      );
      if (already) {
        await this.repo.markInviteAccepted(invite.id, now, tx);
        return { ok: true, membershipId: already.id, alreadyMember: true };
      }

      const inserted = await this.repo.createMembership(
        { businessId: invite.businessId, userId, role: invite.role },
        tx,
      );

      await this.repo.markInviteAccepted(invite.id, now, tx);

      return { ok: true, membershipId: inserted.id, alreadyMember: false };
    });
  }

  async listPendingByBusiness(businessId: string) {
    const now = new Date();
    return this.repo.listPendingByBusiness(businessId, now);
  }

  private buildAcceptUrl(rawToken: string) {
    return `${this.appBaseUrl}/invite/accept?token=${encodeURIComponent(rawToken)}`;
  }

  private async sendInviteEmail(params: {
    to: string;
    businessName: string;
    role: Role;
    link: string;
    expiresAt: Date;
  }) {
    const subject = `You're invited to join ${params.businessName}`;
    const html = `<p>You've been invited as <b>${params.role}</b> to <b>${params.businessName}</b>.</p>
             <p><a href="${params.link}">Accept invite</a></p>
             <p>This link expires on <code>${params.expiresAt.toISOString()}</code>.</p>
             <p>If you didn't expect this, you can ignore this email.</p>`;

    // await this.mailer.sendMail(params.to, subject, html);
    this.logger.log(
      `Sent invite email to ${params.to} with subject "${subject}" and link: ${params.link}`,
    );
  }
}
