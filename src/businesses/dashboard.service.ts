import { Injectable, NotFoundException } from '@nestjs/common';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { addDays, startOfDay, subDays, endOfDay } from 'date-fns';
import { DashboardRepository } from './dashboard.repository';
import { DashboardOverviewDto } from '../bookings/dto/dashboard-overview.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  private buildRanges(bizTz: string) {
    const nowUtc = new Date();
    const nowInTz = toZonedTime(nowUtc, bizTz || 'UTC');

    const todayStartLocal = startOfDay(nowInTz);
    const todayEndLocal = endOfDay(nowInTz);

    const todayStartUtc = fromZonedTime(todayStartLocal, bizTz);
    const todayEndUtc = fromZonedTime(addDays(todayStartLocal, 1), bizTz);

    const upcomingWeekStartUtc = nowUtc;
    const upcomingWeekEndUtc = addDays(nowUtc, 7);

    const last30StartLocal = startOfDay(subDays(nowInTz, 29));
    const last30EndLocal = endOfDay(nowInTz);

    const last30StartUtc = fromZonedTime(last30StartLocal, bizTz);
    const last30EndUtc = fromZonedTime(addDays(last30EndLocal, 1), bizTz);

    const upcomingListStartUtc = nowUtc;
    const upcomingListEndUtc = fromZonedTime(
      addDays(endOfDay(nowInTz), 1),
      bizTz,
    );

    return {
      todayStartUtc,
      todayEndUtc,
      upcomingWeekStartUtc,
      upcomingWeekEndUtc,
      last30StartUtc,
      last30EndUtc,
      upcomingListStartUtc,
      upcomingListEndUtc,
    };
  }

  async getOverview(businessId: string): Promise<DashboardOverviewDto> {
    const biz = await this.repo.getBusinessTimezone(businessId);
    if (!biz) {
      throw new NotFoundException('Business not found');
    }

    const tz = biz.timezone || 'UTC';
    const ranges = this.buildRanges(tz);

    const [
      todayStats,
      upcomingWeekCount,
      noShowRatePercent,
      upcomingBookings,
      topServicesRaw,
      staffStatsRaw,
    ] = await Promise.all([
      this.repo.getStatsForToday({
        businessId,
        startUtc: ranges.todayStartUtc,
        endUtc: ranges.todayEndUtc,
      }),
      this.repo.getUpcomingWeekCount({
        businessId,
        rangeStartUtc: ranges.upcomingWeekStartUtc,
        rangeEndUtc: ranges.upcomingWeekEndUtc,
      }),
      this.repo.getNoShowRateLast30d({
        businessId,
        rangeStartUtc: ranges.last30StartUtc,
        rangeEndUtc: ranges.last30EndUtc,
      }),
      this.repo.getUpcomingBookingsTodayAndTomorrow({
        businessId,
        rangeStartUtc: ranges.upcomingListStartUtc,
        rangeEndUtc: ranges.upcomingListEndUtc,
        limit: 10,
      }),
      this.repo.getTopServicesLast30d({
        businessId,
        rangeStartUtc: ranges.last30StartUtc,
        rangeEndUtc: ranges.last30EndUtc,
        limit: 4,
      }),
      this.repo.getStaffStatsLast30d({
        businessId,
        rangeStartUtc: ranges.last30StartUtc,
        rangeEndUtc: ranges.last30EndUtc,
        limit: 8,
      }),
    ]);

    const totalServiceBookings = topServicesRaw.reduce(
      (sum, r) => sum + Number(r.bookingsCount),
      0,
    );

    const topServices = topServicesRaw.map((r) => ({
      serviceId: r.serviceId,
      name: r.name,
      bookings: Number(r.bookingsCount),
      revenueCents: Number(r.revenueCents),
      sharePercent: totalServiceBookings
        ? Math.round((Number(r.bookingsCount) / totalServiceBookings) * 100)
        : 0,
    }));

    const staffStats = staffStatsRaw.map((r) => ({
      staffId: r.staffId,
      name: r.name,
      bookings: Number(r.bookingsCount),
      revenueCents: Number(r.revenueCents),
    }));

    return {
      stats: {
        bookingsToday: todayStats.bookingsToday,
        upcomingWeek: upcomingWeekCount,
        revenueTodayCents: todayStats.revenueTodayCents,
        noShowRatePercent: Number(noShowRatePercent.toFixed(1)),
      },
      upcomingBookings: upcomingBookings.map((b) => ({
        id: b.id,
        startUtc: b.startUtc.toISOString(),
        customerName: b.customerName,
        serviceName: b.serviceName,
        staffName: b.staffName,
        status: b.status,
        bookedPriceCents: b.bookedPriceCents,
      })),
      topServices,
      staffStats,
    };
  }
}
