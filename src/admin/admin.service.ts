import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { addMonths, isBefore } from 'date-fns';

import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import {
  businesses,
  signupKeys,
  memberships, // adjust to your actual member table name
  roleEnum,
  users, // adjust if your role enum is named differently
} from '@app/db/schema';

import { sha256Base64, randomToken } from '@app/common/utils/crypto.util';
import { LimitsService } from '@app/billing/limit.service';
import {
  ConflictAppError,
  NotFoundAppError,
} from '@app/common/errors/specialized.errors';

import { CreateKeysDto } from './dto/create-keys.dto';
import { RenewPlanDto } from './dto/renew-plan.dto';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly limits: LimitsService,
  ) {}

  async createSignupKey(body: CreateKeysDto) {
    const raw = randomToken(24);
    const codeHash = sha256Base64(raw);

    const [row] = await this.db
      .insert(signupKeys)
      .values({
        codeHash,
        label: body.label,
        plan: (body.plan ?? 'TRIAL') as any,
        trialDays: body.trialDays ?? 14,
        maxUses: body.maxUses ?? 1,
        emailDomain: body.emailDomain,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      })
      .returning();

    return { key: raw, meta: row };
  }

  async listSignupKeys() {
    return this.db.select().from(signupKeys);
  }

  async listBusinessesWithOwner() {
    const rows = await this.db
      .select({
        business: businesses,
        member: memberships,
        user: users,
      })
      .from(businesses)
      .leftJoin(
        memberships,
        and(
          eq(memberships.businessId, businesses.id),
          eq(memberships.role, 'OWNER'),
          isNull(memberships.deletedAt),
        ),
      )
      .leftJoin(users, eq(users.id, memberships.userId));

    return rows;
  }

  async renewPlanForBusiness(businessId: string, dto: RenewPlanDto) {
    const [business] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business || business.deletedAt) {
      throw new NotFoundAppError('Business not found');
    }

    if (business.status === 'canceled') {
      throw new ConflictAppError('Cannot renew a canceled subscription');
    }

    const targetPlan = dto.plan ?? business.plan;
    const months = dto.billingPeriodMonths ?? 1;

    const now = new Date();

    const baseDate =
      business.planRenewsAt && isBefore(now, business.planRenewsAt)
        ? business.planRenewsAt
        : now;

    const nextRenewal = addMonths(baseDate, months);

    const limitsForPlan = this.limits.getLimitsForPlan(
      targetPlan,
      business.limitsJson,
    );
    const isTrial = targetPlan === 'TRIAL';

    await this.db
      .update(businesses)
      .set({
        plan: targetPlan,
        status: isTrial ? 'trialing' : 'active',
        trialEndsAt: isTrial
          ? (business.trialEndsAt ?? nextRenewal)
          : (business.trialEndsAt ?? business.trialEndsAt),
        planRenewsAt: isTrial ? null : nextRenewal,
        suspendedAt: null,
        limitsJson: limitsForPlan,
        updatedAt: now,
      })
      .where(eq(businesses.id, businessId));

    const [updated] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    return updated;
  }

  async suspendBusinessPlan(businessId: string) {
    const [existing] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!existing) {
      throw new NotFoundAppError('Business not found');
    }

    const now = new Date();

    if (existing.status === 'suspended' && existing.suspendedAt) {
      return existing;
    }

    const [updated] = await this.db
      .update(businesses)
      .set({
        status: 'suspended',
        suspendedAt: now,
        updatedAt: now,
      })
      .where(eq(businesses.id, businessId))
      .returning();

    return updated;
  }
}
