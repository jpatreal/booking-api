import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import {
  businesses,
  staff as staffTable,
  services as servicesTable,
  bookings as bookingsTable,
} from '@app/db/schema';
import { and, count, eq, gte, isNull, lte } from 'drizzle-orm';
import {
  ForbiddenAppError,
  NotFoundAppError,
} from '@app/common/errors/specialized.errors';

type Plan = 'TEST' | 'TRIAL' | 'FREE' | 'PRO';

type Limits = {
  staff: number | null;
  services: number | null;
  activeBookingsPerMonth: number | null;

  maxServiceDurationMin?: number | null;
};

type BusinessRow = {
  id: string;
  plan: Plan;
  limitsJson: any | null;
  trialEndsAt: Date | null;
};

const PLAN_DEFAULTS: Record<Plan, Limits> = {
  TEST: {
    staff: 2,
    services: 5,
    activeBookingsPerMonth: 50,
    maxServiceDurationMin: 180,
  },
  TRIAL: {
    staff: 5,
    services: 20,
    activeBookingsPerMonth: 300,
    maxServiceDurationMin: 240,
  },
  FREE: {
    staff: 3,
    services: 10,
    activeBookingsPerMonth: 150,
    maxServiceDurationMin: 180,
  },
  PRO: {
    staff: null,
    services: null,
    activeBookingsPerMonth: null,
    maxServiceDurationMin: null,
  },
};

function parseOverride(json: string | null): Partial<Limits> {
  if (!json) return {};
  try {
    const obj = JSON.parse(json);
    const pick: Partial<Limits> = {};
    for (const k of [
      'staff',
      'services',
      'activeBookingsPerMonth',
      'maxServiceDurationMin',
    ] as const) {
      if (k in obj) (pick as any)[k] = obj[k];
    }
    return pick;
  } catch {
    return {};
  }
}

@Injectable()
export class LimitsService {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  getLimitsForPlan(plan: Plan, limitsJson?: any | null): Limits {
    const base = PLAN_DEFAULTS[plan];
    const override = parseOverride(limitsJson ?? null);
    const merged: Limits = { ...base, ...override };
    return merged;
  }

  async assertCanCreateStaff(businessId: string) {
    const { limits } = await this.getEffectiveLimits(businessId);
    if (limits.staff === null) return;

    const total = await this.countStaff(businessId);
    if (total >= limits.staff) {
      throw new ForbiddenAppError('Staff limit reached for current plan', {
        limit: limits.staff,
        current: total,
      });
    }
  }

  async assertCanCreateService(businessId: string) {
    const { limits } = await this.getEffectiveLimits(businessId);
    if (limits.services === null) return;

    const total = await this.countServices(businessId);
    if (total >= limits.services) {
      throw new ForbiddenAppError('Services limit reached for current plan', {
        limit: limits.services,
        current: total,
      });
    }
  }

  async assertCanCreateBooking(businessId: string, startUtc: Date) {
    const { limits } = await this.getEffectiveLimits(businessId);
    if (limits.activeBookingsPerMonth === null) return;

    const [firstDay, firstOfNext] = monthBoundsUTC(startUtc);
    const total = await this.countBookingsInRange(
      businessId,
      firstDay,
      firstOfNext,
    );
    if (total >= limits.activeBookingsPerMonth) {
      throw new ForbiddenAppError(
        'Active bookings limit reached for current plan',
        {
          limit: limits.activeBookingsPerMonth,
          current: total,
        },
      );
    }
  }

  async assertBusinessCanAcceptBookings(businessId: string) {
    const biz = await this.getBusiness(businessId);
    if (!biz) {
      throw new NotFoundAppError('Business not found', {
        entity: 'Business',
        identifier: businessId,
      });
    }

    if (biz.plan !== 'TRIAL') return;

    if (!biz.trialEndsAt) return;

    const now = new Date();
    if (now > biz.trialEndsAt) {
      throw new ForbiddenAppError('Trial has expired for this business', {
        code: 'TRIAL_EXPIRED',
        trialEndedAt: biz.trialEndsAt,
        plan: biz.plan,
      });
    }
  }

  async getEffectiveLimits(
    businessId: string,
  ): Promise<{ plan: Plan; limits: Limits }> {
    const biz = await this.getBusiness(businessId);
    if (!biz) {
      throw new NotFoundAppError('Business not found', {
        entity: 'Business',
        identifier: businessId,
      });
    }

    const base = PLAN_DEFAULTS[biz.plan];
    const override = parseOverride(biz.limitsJson);
    const merged: Limits = { ...base, ...override };
    return { plan: biz.plan, limits: merged };
  }

  async countStaff(businessId: string): Promise<number> {
    const [row] = await this.db
      .select({ c: count() })
      .from(staffTable)
      .where(
        and(
          eq(staffTable.businessId, businessId),
          isNull(staffTable.deletedAt),
        ),
      );
    return Number(row?.c ?? 0);
  }

  async countServices(businessId: string): Promise<number> {
    const [row] = await this.db
      .select({ c: count() })
      .from(servicesTable)
      .where(eq(servicesTable.businessId, businessId));
    return Number(row?.c ?? 0);
  }

  async countBookingsInRange(
    businessId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const [row] = await this.db
      .select({ c: count() })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.businessId, businessId),
          gte(bookingsTable.startUtc, from),
          lte(bookingsTable.startUtc, to),
        ),
      );
    return Number(row?.c ?? 0);
  }

  private async getBusiness(businessId: string): Promise<BusinessRow | null> {
    const [row] = await this.db
      .select({
        id: businesses.id,
        plan: businesses.plan as any,
        limitsJson: businesses.limitsJson,
        trialEndsAt: businesses.trialEndsAt,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    return (row as any) ?? null;
  }
}

function monthBoundsUTC(d: Date): [Date, Date] {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const next = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
  return [start, next];
}
