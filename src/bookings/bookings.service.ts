import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import { addDays, addMinutes, differenceInMinutes, isBefore } from 'date-fns';
import { toZonedTime, format, fromZonedTime } from 'date-fns-tz';

import {
  businesses,
  services,
  bookings,
  businessHours,
  staffAvailability,
} from '@app/db/schema';

import { BookingsRepository } from './bookings.repository';
import { BookingsCache } from './bookings.cache';

import {
  ConflictAppError,
  NotFoundAppError,
} from '@app/common/errors/specialized.errors';

type Status = typeof bookings.$inferSelect.status;

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly repo: BookingsRepository,
    private readonly cache: BookingsCache,
  ) {}

  // ---------- Helpers

  private toDate(v: string) {
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new BadRequestException('Invalid date');
    return d;
  }

  private assertRange(startUtc: Date, endUtc: Date) {
    if (startUtc >= endUtc)
      throw new BadRequestException('startUtc must be before endUtc');
  }

  private businessLocalYmd(d: Date, tz: string) {
    const z = toZonedTime(d, tz);
    return format(z, 'yyyy-MM-dd', { timeZone: tz });
  }

  private async ensureEntities(
    businessId: string,
    serviceId: string,
    staffId: string,
  ) {
    const [biz, svc, stf] = await Promise.all([
      this.repo.getBusiness(businessId),
      this.repo.getService(businessId, serviceId),
      this.repo.getStaff(businessId, staffId),
    ]);
    if (!biz) throw new NotFoundAppError('Business not found');
    if (!svc) throw new NotFoundAppError('Service not found');
    if (!stf) throw new NotFoundAppError('Staff not found');

    const ss = await this.repo.staffOffersService(staffId, serviceId);
    if (!ss || ss.isActive === false || ss.isBookable === false)
      throw new ConflictAppError('Staff is not bookable for this service');

    return { biz, svc, stf, ss };
  }

  private async assertWindowsNow(
    bizTz: string,
    svc: typeof services.$inferSelect,
    startUtc: Date,
  ) {
    const now = new Date();
    const minLead = svc.minLeadMinutes ?? 0;
    const maxAdvance = svc.maxAdvanceDays ?? 90;

    if (differenceInMinutes(startUtc, now) < minLead) {
      throw new ConflictAppError(
        `Must book at least ${minLead} minutes in advance`,
      );
    }
    const latest = addDays(now, maxAdvance);
    if (isBefore(latest, startUtc)) {
      throw new ConflictAppError(
        `Bookings allowed only up to ${maxAdvance} day(s) ahead`,
      );
    }
  }

  private withinLocalWindows(
    bizTz: string,
    startUtc: Date,
    endUtc: Date,
    bizHoursRows: (typeof businessHours.$inferSelect)[],
    staffAvailRows: (typeof staffAvailability.$inferSelect)[],
  ) {
    const timeZone = bizTz || 'UTC';

    const startLocal = toZonedTime(startUtc, timeZone);
    const endLocal = toZonedTime(endUtc, timeZone);

    let startDow = startLocal.getDay();
    let endDow = endLocal.getDay();

    if (startDow !== endDow) return false;

    const pad = (n: number) => String(n).padStart(2, '0');
    const toHHMMSS = (d: Date) =>
      `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

    const startHHMM = toHHMMSS(startLocal);
    const endHHMM = toHHMMSS(endLocal);

    // --- Business hours ---
    const bizBlock = bizHoursRows.find((b) => b.dayOfWeek === startDow);
    if (!bizBlock) return false;

    const withinBusiness =
      bizBlock.openTimeLocal <= startHHMM && endHHMM <= bizBlock.closeTimeLocal;

    if (!withinBusiness) return false;

    // --- Staff availability ---
    const staffBlocks = staffAvailRows.filter((a) => a.dayOfWeek === startDow);
    if (staffBlocks.length === 0) return false;

    const withinStaff = staffBlocks.some(
      (a) => a.startTimeLocal <= startHHMM && endHHMM <= a.endTimeLocal,
    );

    return withinStaff;
  }

  // ---------- API

  async list(businessId: string, q: any) {
    return this.repo.list(businessId, q);
  }

  async get(businessId: string, id: string) {
    const row = await this.repo.getById(businessId, id);
    if (!row) throw new NotFoundAppError('Booking not found');
    return row;
  }

  async create(
    businessId: string,
    input: {
      serviceId: string;
      staffId: string;
      customerId?: string;
      customerName: string;
      customerEmail?: string;
      startUtc: string;
      endUtc: string;
      notes?: string;
      bookedPriceCents?: number;
      bookedDurationMin?: number;
      source?: string;
      channelRef?: string;
    },
    actorUserId?: string,
  ) {
    const startUtc = this.toDate(input.startUtc);
    const endUtc = this.toDate(input.endUtc);
    this.assertRange(startUtc, endUtc);

    const { biz, svc, stf, ss } = await this.ensureEntities(
      businessId,
      input.serviceId,
      input.staffId,
    );
    await this.assertWindowsNow(biz.timezone, svc, startUtc);

    const [bizHours, staffAvail, timeOffList] = await Promise.all([
      this.repo.getBusinessHours(businessId),
      this.repo.getStaffAvailability(stf.id),
      this.repo.getStaffTimeOffInRange(stf.id, startUtc, endUtc),
    ]);

    if (
      !this.withinLocalWindows(
        biz.timezone,
        startUtc,
        endUtc,
        bizHours as any,
        staffAvail as any,
      )
    ) {
      throw new ConflictAppError(
        'Requested time is outside business/staff availability',
      );
    }
    if (timeOffList.length > 0) {
      throw new ConflictAppError('Staff is on time off during requested time');
    }

    // Capacity & overlap
    const overlapping = await this.repo.countOverlappingActive(
      stf.id,
      startUtc,
      endUtc,
    );
    const maxCapacity = svc.capacity ?? 1;
    if (overlapping >= maxCapacity)
      throw new ConflictAppError('Time slot is fully booked');

    let customerId = input.customerId;
    if (!customerId && input.customerEmail) {
      const c = await this.repo.upsertCustomerIfNeeded(
        businessId,
        input.customerName,
        input.customerEmail,
      );
      customerId = c?.id;
    }

    const payload = {
      businessId,
      serviceId: svc.id,
      staffId: stf.id,
      customerId: customerId ?? null,
      customerName: input.customerName,
      customerEmail: input.customerEmail ?? null,
      status: 'PENDING' as Status,
      startUtc,
      endUtc,
      notes: input.notes ?? null,
      bookedPriceCents:
        input.bookedPriceCents ?? ss.priceCentsOverride ?? svc.priceCents ?? 0,
      bookedDurationMin:
        input.bookedDurationMin ??
        ss.durationMinOverride ??
        svc.durationMin ??
        0,
      serviceSnapshotJson: {
        serviceId: svc.id,
        name: svc.name,
        basePriceCents: svc.priceCents,
        baseDurationMin: svc.durationMin,
        staffPriceCents: ss.priceCentsOverride,
        staffDurationMin: ss.durationMinOverride,
        bufferBeforeMin: ss.bufferBeforeMin,
        bufferAfterMin: ss.bufferAfterMin,
        capacity: svc.capacity,
      } as any,
      source: input.source ?? 'internal',
      channelRef: input.channelRef ?? null,
      paymentStatus: 'unpaid',
      depositCents: 0,
    };

    const created = await this.repo.insertBooking(payload, actorUserId);

    const localYmd = this.businessLocalYmd(startUtc, biz.timezone);
    await this.cache.bustAvailability(businessId, stf.id, localYmd);

    return created;
  }

  async reschedule(
    businessId: string,
    id: string,
    dto: { startUtc: string; endUtc: string; note?: string },
    byUserId?: string,
  ) {
    const current = await this.get(businessId, id);

    const startUtc = this.toDate(dto.startUtc);
    const endUtc = this.toDate(dto.endUtc);
    this.assertRange(startUtc, endUtc);

    const biz = await this.repo.getBusiness(businessId);
    if (!biz) throw new NotFoundAppError('Business not found');

    const svc = await this.repo.getService(businessId, current.serviceId);
    const stf = await this.repo.getStaff(businessId, current.staffId);
    if (!svc || !stf) throw new NotFoundAppError('Service/Staff not found');

    await this.assertWindowsNow(biz.timezone, svc, startUtc);

    const [bizHours, staffAvail, timeOffList] = await Promise.all([
      this.repo.getBusinessHours(businessId),
      this.repo.getStaffAvailability(stf.id),
      this.repo.getStaffTimeOffInRange(stf.id, startUtc, endUtc),
    ]);
    if (
      !this.withinLocalWindows(
        biz.timezone,
        startUtc,
        endUtc,
        bizHours as any,
        staffAvail as any,
      )
    ) {
      throw new ConflictAppError(
        'Requested time is outside business/staff availability',
      );
    }
    if (timeOffList.length > 0) {
      throw new ConflictAppError('Staff is on time off during requested time');
    }

    const overlapping = await this.repo.countOverlappingActive(
      stf.id,
      startUtc,
      endUtc,
      id,
    );
    const maxCapacity = svc.capacity ?? 1;
    if (overlapping >= maxCapacity)
      throw new ConflictAppError('Time slot is fully booked');

    const updated = await this.repo.reschedule(
      businessId,
      id,
      startUtc,
      endUtc,
      byUserId,
      dto.note,
    );

    const ymdNew = this.businessLocalYmd(startUtc, biz.timezone);
    const ymdOld = this.businessLocalYmd(current.startUtc, biz.timezone);
    await Promise.all([
      this.cache.bustAvailability(businessId, stf.id, ymdNew),
      this.cache.bustAvailability(businessId, stf.id, ymdOld),
    ]);

    return updated;
  }

  async changeStatus(
    businessId: string,
    id: string,
    to: Status,
    byUserId?: string,
    note?: string,
    reason?: string,
  ) {
    const updated = await this.repo.updateStatus(
      businessId,
      id,
      to,
      byUserId,
      note,
      to === 'CANCELLED' ? { cancelReason: reason ?? null } : undefined,
    );
    if (!updated) throw new NotFoundAppError('Booking not found');
    return updated;
  }

  // ================= Public / Client

  zonedYmdTimeToUtc(ymd: string, hhmmss: string, tz: string): Date {
    const localIso = `${ymd}T${hhmmss}`;
    return fromZonedTime(localIso, tz);
  }

  async createPublic(
    businessId: string,
    dto: {
      serviceId: string;
      staffId: string;
      customerName: string;
      customerEmail?: string;
      startUtc: string;
      endUtc: string;
      notes?: string;
      channelRef?: string;
    },
  ) {
    return this.create(
      businessId,
      {
        ...dto,
        source: 'public',
      } as any,
      undefined,
    );
  }

  async publicAvailability(
    businessId: string,
    q: {
      serviceId: string;
      staffId: string;
      dateLocal?: string;
      startUtcFrom?: string;
      startUtcTo?: string;
    },
  ) {
    const biz = await this.repo.getBusiness(businessId);
    if (!biz) throw new NotFoundAppError('Business not found');

    const svc = await this.repo.getService(businessId, q.serviceId);
    const stf = await this.repo.getStaff(businessId, q.staffId);
    if (!svc || !stf) throw new NotFoundAppError('Service/Staff not found');

    const tz = biz.timezone || 'UTC';
    const ymd =
      q.dateLocal ??
      format(toZonedTime(new Date(), tz), 'yyyy-MM-dd', { timeZone: tz });

    const cached = await this.cache.getFreeSlots(
      businessId,
      svc.id,
      stf.id,
      ymd,
    );
    if (cached) return cached;

    const dayStartUtc = this.zonedYmdTimeToUtc(ymd, '00:00:00', tz);
    const dayEndUtc = this.zonedYmdTimeToUtc(ymd, '23:59:59', tz);

    const [bizHoursRows, staffAvailRows] = await Promise.all([
      this.repo.getBusinessHours(businessId),
      this.repo.getStaffAvailability(stf.id),
    ]);

    const ss = await this.repo.staffOffersService(stf.id, svc.id);
    if (!ss || ss.isActive === false || ss.isBookable === false)
      throw new ConflictAppError('Staff is not bookable for this service');

    const durationMin = ss.durationMinOverride ?? svc.durationMin ?? 0;
    const bufferBefore = ss.bufferBeforeMin ?? 0;
    const bufferAfter = ss.bufferAfterMin ?? 0;
    const stepMin = Math.max(5, durationMin);

    const dow = toZonedTime(dayStartUtc, tz).getDay();

    const bizBlock = bizHoursRows.find((b) => b.dayOfWeek === dow);
    const staffBlocks = staffAvailRows.filter((a) => a.dayOfWeek === dow);
    if (!bizBlock || staffBlocks.length === 0) {
      const res = { dateLocal: ymd, slots: [] as any[] };
      await this.cache.setFreeSlots(businessId, svc.id, stf.id, ymd, res, 30);
      return res;
    }

    const bizStart = this.zonedYmdTimeToUtc(ymd, bizBlock.openTimeLocal, tz);
    const bizEnd = this.zonedYmdTimeToUtc(ymd, bizBlock.closeTimeLocal, tz);

    const ranges: Array<{ start: Date; end: Date }> = [];
    for (const a of staffBlocks) {
      const s = this.zonedYmdTimeToUtc(ymd, a.startTimeLocal, tz);
      const e = this.zonedYmdTimeToUtc(ymd, a.endTimeLocal, tz);
      const start = new Date(Math.max(s.getTime(), bizStart.getTime()));
      const end = new Date(Math.min(e.getTime(), bizEnd.getTime()));
      if (start < end) ranges.push({ start, end });
    }

    const capacity = svc.capacity ?? 1;
    const slots: Array<{ startUtc: string; endUtc: string }> = [];

    for (const r of ranges) {
      let cur = new Date(r.start);
      while (cur.getTime() + durationMin * 60000 <= r.end.getTime()) {
        const start = new Date(cur.getTime() - bufferBefore * 60000);
        const end = new Date(
          cur.getTime() + (durationMin + bufferAfter) * 60000,
        );

        const timeOff = await this.repo.getStaffTimeOffInRange(
          stf.id,
          start,
          end,
        );
        if (timeOff.length === 0) {
          const overlapping = await this.repo.countOverlappingActive(
            stf.id,
            start,
            end,
          );
          if (overlapping < capacity) {
            slots.push({
              startUtc: cur.toISOString(),
              endUtc: new Date(
                cur.getTime() + durationMin * 60000,
              ).toISOString(),
            });
          }
        }
        cur = addMinutes(cur, stepMin);
      }
    }

    const result = { dateLocal: ymd, slots };
    await this.cache.setFreeSlots(businessId, svc.id, stf.id, ymd, result, 30);
    return result;
  }

  async publicConfig(businessId: string) {
    const biz = await this.repo.getBusiness(businessId);
    if (!biz) throw new NotFoundAppError('Business not found');

    const [svcList, staffList] = await Promise.all([
      this.repo.listPublicServices(businessId),
      this.repo.listPublicStaffForServices(businessId),
    ]);

    return {
      business: {
        id: biz.id,
        name: biz.name,
        slug: biz.slug,
        timezone: biz.timezone || 'Asia/Manila',

        logoUrl: null,
        primaryColor: '#3b82f6',
        tagline: 'Book your appointment in seconds.',
        address: null,
      },
      services: svcList,
      staff: staffList,
    };
  }
}
