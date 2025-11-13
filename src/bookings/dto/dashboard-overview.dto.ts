import { bookingStatus } from '@app/db/schema';

export type BookingStatus = (typeof bookingStatus.enumValues)[number];

export class DashboardStatsDto {
  bookingsToday!: number;
  upcomingWeek!: number;
  revenueTodayCents!: number;
  noShowRatePercent!: number;
}

export class DashboardUpcomingBookingDto {
  id!: string;
  startUtc!: string;
  customerName!: string;
  serviceName!: string;
  staffName!: string;
  status!: BookingStatus;
  bookedPriceCents!: number;
}

export class DashboardTopServiceDto {
  serviceId!: string;
  name!: string;
  bookings!: number;
  revenueCents!: number;
  sharePercent!: number;
}

export class DashboardStaffStatDto {
  staffId!: string;
  name!: string;
  bookings!: number;
  revenueCents!: number;
}

export class DashboardOverviewDto {
  stats!: DashboardStatsDto;
  upcomingBookings!: DashboardUpcomingBookingDto[];
  topServices!: DashboardTopServiceDto[];
  staffStats!: DashboardStaffStatDto[];
}
