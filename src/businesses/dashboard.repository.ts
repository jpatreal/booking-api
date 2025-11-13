import { Inject, Injectable } from '@nestjs/common';
import type { DB } from '@app/db';
import { DRIZZLE } from '@app/db/db.module';
import {
  bookings,
  services,
  staff,
  businesses,
  bookingStatus,
} from '@app/db/schema';
import { and, eq, gte, lt, inArray, sql } from 'drizzle-orm';

@Injectable()
export class DashboardRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async getBusinessTimezone(businessId: string) {
    const [biz] = await this.db
      .select({ id: businesses.id, timezone: businesses.timezone })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    return biz;
  }

  async getStatsForToday(options: {
    businessId: string;
    startUtc: Date;
    endUtc: Date;
  }) {
    const { businessId, startUtc, endUtc } = options;

    const [row] = await this.db
      .select({
        bookingsToday: sql<number>`count(*)`,
        revenueTodayCents: sql<number>`coalesce(sum(${bookings.bookedPriceCents}), 0)`,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.businessId, businessId),
          gte(bookings.startUtc, startUtc),
          lt(bookings.startUtc, endUtc),
          inArray(bookings.status, ['CONFIRMED', 'COMPLETED']),
        ),
      );

    return {
      bookingsToday: Number(row?.bookingsToday ?? 0),
      revenueTodayCents: Number(row?.revenueTodayCents ?? 0),
    };
  }

  async getUpcomingWeekCount(options: {
    businessId: string;
    rangeStartUtc: Date;
    rangeEndUtc: Date;
  }) {
    const { businessId, rangeStartUtc, rangeEndUtc } = options;

    const [row] = await this.db
      .select({
        upcomingWeek: sql<number>`count(*)`,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.businessId, businessId),
          gte(bookings.startUtc, rangeStartUtc),
          lt(bookings.startUtc, rangeEndUtc),
          inArray(bookings.status, [
            'PENDING',
            'CONFIRMED',
            'COMPLETED',
            'NO_SHOW',
          ]),
        ),
      );

    return Number(row?.upcomingWeek ?? 0);
  }

  async getNoShowRateLast30d(options: {
    businessId: string;
    rangeStartUtc: Date;
    rangeEndUtc: Date;
  }) {
    const { businessId, rangeStartUtc, rangeEndUtc } = options;

    const [row] = await this.db
      .select({
        total: sql<number>`count(*)`,
        noShows: sql<number>`sum(case when ${bookings.status} = 'NO_SHOW' then 1 else 0 end)`,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.businessId, businessId),
          gte(bookings.startUtc, rangeStartUtc),
          lt(bookings.startUtc, rangeEndUtc),
          inArray(bookings.status, ['COMPLETED', 'NO_SHOW']),
        ),
      );

    const total = Number(row?.total ?? 0);
    const noShows = Number(row?.noShows ?? 0);

    if (!total) return 0;

    return (noShows / total) * 100;
  }

  async getUpcomingBookingsTodayAndTomorrow(options: {
    businessId: string;
    rangeStartUtc: Date;
    rangeEndUtc: Date;
    limit?: number;
  }) {
    const { businessId, rangeStartUtc, rangeEndUtc, limit = 20 } = options;

    const rows = await this.db
      .select({
        id: bookings.id,
        startUtc: bookings.startUtc,
        customerName: bookings.customerName,
        status: bookings.status,
        bookedPriceCents: bookings.bookedPriceCents,
        serviceName: services.name,
        staffName: staff.name,
      })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(staff, eq(staff.id, bookings.staffId))
      .where(
        and(
          eq(bookings.businessId, businessId),
          gte(bookings.startUtc, rangeStartUtc),
          lt(bookings.startUtc, rangeEndUtc),
          inArray(bookings.status, ['PENDING', 'CONFIRMED', 'COMPLETED']),
        ),
      )
      .orderBy(bookings.startUtc)
      .limit(limit);

    return rows;
  }

  async getTopServicesLast30d(options: {
    businessId: string;
    rangeStartUtc: Date;
    rangeEndUtc: Date;
    limit?: number;
  }) {
    const { businessId, rangeStartUtc, rangeEndUtc, limit = 5 } = options;

    const rows = await this.db
      .select({
        serviceId: bookings.serviceId,
        name: services.name,
        bookingsCount: sql<number>`count(*)`,
        revenueCents: sql<number>`coalesce(sum(${bookings.bookedPriceCents}), 0)`,
      })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .where(
        and(
          eq(bookings.businessId, businessId),
          gte(bookings.startUtc, rangeStartUtc),
          lt(bookings.startUtc, rangeEndUtc),
          inArray(bookings.status, ['CONFIRMED', 'COMPLETED']),
        ),
      )
      .groupBy(bookings.serviceId, services.name)
      .orderBy(sql`count(*) desc`)
      .limit(limit);

    return rows;
  }

  async getStaffStatsLast30d(options: {
    businessId: string;
    rangeStartUtc: Date;
    rangeEndUtc: Date;
    limit?: number;
  }) {
    const { businessId, rangeStartUtc, rangeEndUtc, limit = 10 } = options;

    const rows = await this.db
      .select({
        staffId: bookings.staffId,
        name: staff.name,
        bookingsCount: sql<number>`count(*)`,
        revenueCents: sql<number>`coalesce(sum(${bookings.bookedPriceCents}), 0)`,
      })
      .from(bookings)
      .innerJoin(staff, eq(staff.id, bookings.staffId))
      .where(
        and(
          eq(bookings.businessId, businessId),
          gte(bookings.startUtc, rangeStartUtc),
          lt(bookings.startUtc, rangeEndUtc),
          inArray(bookings.status, ['CONFIRMED', 'COMPLETED']),
        ),
      )
      .groupBy(bookings.staffId, staff.name)
      .orderBy(sql`count(*) desc`)
      .limit(limit);

    return rows;
  }
}
