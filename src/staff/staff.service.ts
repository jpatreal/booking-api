import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import type { DB } from '@app/db';
import { DRIZZLE } from '@app/db/db.module';
import { StaffRepository } from './staff.repository';
import { bookings as bookingsTable } from '@app/db/schema';
import {
  ListStaffQueryDto,
  CreateStaffDto,
  UpdateStaffDto,
  BulkUpsertStaffServicesDto,
  BulkUpsertAvailabilityDto,
  CreateTimeOffDto,
  WalkInBookingDto,
} from './dto/staff.dto';
import { and, eq, sql } from 'drizzle-orm';
import { LimitsService } from '@app/billing/limit.service';
import { ConflictAppError } from '@app/common/errors/specialized.errors';
import {
  isUniqueViolation,
  pgConstraint,
} from '@app/common/errors/pg-like.error';
import { StaffCache } from './staff.cache';
import { AuditLogService } from '@app/audit-log/audit-log.service';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { addDays, format } from 'date-fns';
import { BusinessesRepository } from '@app/businesses/businesses.repository';

@Injectable()
export class StaffService {
  constructor(
    private readonly repo: StaffRepository,
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly limits: LimitsService,
    private readonly staffCache: StaffCache,
    private readonly audit: AuditLogService,
    private readonly bizRepo: BusinessesRepository,
  ) {}

  async list(businessId: string, q: ListStaffQueryDto) {
    const activeOnly =
      q.activeOnly !== undefined ? q.activeOnly === 'true' : true;
    return this.staffCache.getList(
      businessId,
      { q: q.q, page: q.page, pageSize: q.pageSize, activeOnly },
      async () =>
        await this.repo.list(
          { businessId, q: q.q, activeOnly },
          q.page,
          q.pageSize,
        ),
      15,
    );
  }

  async get(businessId: string, staffId: string) {
    const row = await this.staffCache.getById(businessId, staffId);
    if (!row) throw new NotFoundException('Staff not found');
    return row;
  }

  async create(businessId: string, dto: CreateStaffDto, actorUserId?: string) {
    await this.limits.assertCanCreateStaff(businessId);
    try {
      const created = await this.repo.insert({
        businessId,
        userId: dto.userId ?? null,
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        bio: dto.bio ?? null,
        imageUrl: dto.imageUrl ?? null,
        color: dto.color ?? null,
        displayOrder: dto.displayOrder ?? 0,
        isActive: true,
      } as any);

      await this.audit.log({
        businessId,
        actorUserId,
        action: 'staff.create',
        entity: 'Staff',
        entityId: created.id,
        meta: this.audit.buildMeta({
          name: created.name,
          email: created.email,
          userId: created.userId,
          isActive: created.isActive,
        }),
      });

      await this.staffCache.invalidateById(businessId, created.id);
      await this.staffCache.bumpListVer(businessId);
      return created;
    } catch (e: any) {
      if (isUniqueViolation(e, 'staff_business_email_uq'))
        throw new ConflictAppError('Email already used in this business');
      if (isUniqueViolation(e, 'staff_business_user_uq'))
        throw new BadRequestException(
          'User is already a staff member in this business',
        );
      if (isUniqueViolation(e))
        throw new ConflictAppError(
          `Unique constraint failed: ${pgConstraint(e) ?? 'unknown'}`,
        );
      throw e;
    }
  }

  async update(
    businessId: string,
    staffId: string,
    dto: UpdateStaffDto,
    actorUserId?: string,
  ) {
    const before = await this.repo.findById(staffId, { businessId });
    if (!before) throw new NotFoundException('Staff not found');

    const updated = await this.repo.updateById(
      staffId,
      { ...dto },
      { businessId },
    );
    if (!updated) throw new NotFoundException('Staff not found');

    await this.audit.log({
      businessId,
      actorUserId,
      action: 'staff.update',
      entity: 'Staff',
      entityId: staffId,
      meta: this.audit.buildMeta({
        before: {
          name: before.name,
          email: before.email,
          phone: before.phone,
          isActive: before.isActive,
          color: before.color,
          displayOrder: before.displayOrder,
        },
        after: {
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          isActive: updated.isActive,
          color: updated.color,
          displayOrder: updated.displayOrder,
        },
      }),
    });

    await this.staffCache.invalidateById(businessId, staffId);
    await this.staffCache.bumpListVer(businessId);
    return updated;
  }

  async remove(businessId: string, staffId: string, actorUserId?: string) {
    const deleted = await this.repo.softDelete(staffId, { businessId });
    if (!deleted) throw new NotFoundException('Staff not found');

    await this.audit.log({
      businessId,
      actorUserId,
      action: 'staff.softDelete',
      entity: 'Staff',
      entityId: staffId,
      meta: this.audit.buildMeta({ ok: true }),
    });

    await this.staffCache.invalidateById(businessId, staffId);
    await this.staffCache.bumpListVer(businessId);
    return { deleted: true };
  }

  // ===== Services mapping =====
  async bulkUpsertServices(
    businessId: string,
    staffId: string,
    dto: BulkUpsertStaffServicesDto,
    actorUserId?: string,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);
    const results = await this.db.transaction(async (tx) => {
      const arr: any[] = [];
      for (const item of dto.items) {
        arr.push(await this.repo.upsertStaffService(staffId, item, tx));
      }

      await this.audit.logInTx(tx, {
        businessId,
        actorUserId,
        action: 'staffService.bulkUpsert',
        entity: 'Staff',
        entityId: staffId,
        meta: this.audit.buildMeta({
          count: dto.items.length,
          items: dto.items.slice(0, 10),
        }),
      });
      return arr;
    });
    await this.staffCache.touchServices(staffId);
    return results;
  }

  async listStaffServices(businessId: string, staffId: string) {
    await this.ensureStaffInBusiness(businessId, staffId);
    return this.staffCache.listServices(staffId, async () =>
      this.repo.listStaffServices(staffId),
    );
  }

  async deleteStaffService(
    businessId: string,
    staffId: string,
    serviceId: string,
    actorUserId?: string,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);
    const row = await this.repo.deleteStaffService(staffId, serviceId);
    if (!row) throw new NotFoundException('Mapping not found');

    await this.audit.log({
      businessId,
      actorUserId,
      action: 'staffService.delete',
      entity: 'Staff',
      entityId: staffId,
      meta: this.audit.buildMeta({ serviceId }),
    });

    await this.staffCache.touchServices(staffId);
    return row;
  }

  // ===== Availability =====
  async bulkUpsertAvailability(
    businessId: string,
    staffId: string,
    dto: BulkUpsertAvailabilityDto,
    actorUserId?: string,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);

    if (!dto?.items?.length) {
      throw new BadRequestException('No availability items provided');
    }

    const byDay = new Map<
      number,
      { startTimeLocal: string; endTimeLocal: string }[]
    >();
    for (const it of dto.items) {
      const day = Number(it.dayOfWeek);
      if (!Number.isInteger(day) || day < 1 || day > 7)
        throw new BadRequestException(`Invalid dayOfWeek: ${it.dayOfWeek}`);

      const norm = (t: string) =>
        /^\d{2}:\d{2}:\d{2}$/.test(t) ? t : `${t}:00`;
      const startTimeLocal = norm(it.startTimeLocal);
      const endTimeLocal = norm(it.endTimeLocal);

      this.assertLocalTimeRange(startTimeLocal, endTimeLocal);

      const arr = byDay.get(day) ?? [];
      arr.push({ startTimeLocal, endTimeLocal });
      byDay.set(day, arr);
    }

    for (const [, items] of byDay) {
      this.assertNoOverlapLocalRanges(items);
    }

    const force = (dto as any).force === true;
    const N_DAYS = 30;
    let conflictsFound = 0;
    const conflictSamples: Array<{
      dateLocal: string;
      startUtc: string;
      endUtc: string;
      bookingId?: string;
    }> = [];

    if (!force) {
      const staff = await this.repo.findById(staffId, { businessId });
      if (!staff) throw new NotFoundException('Staff not found');
      const biz = await this.bizRepo.findAndGetBusinessTimeZone(businessId);
      const nowInTz = toZonedTime(new Date(), biz.timezone);
      const todayYmd = format(nowInTz, 'yyyy-MM-dd');

      for (let i = 0; i < N_DAYS; i++) {
        const localDate = addDays(new Date(todayYmd + 'T00:00:00'), i);
        const dowJs = localDate.getDay();
        const dayOfWeek = dowJs === 0 ? 7 : dowJs;

        const items = byDay.get(dayOfWeek);
        if (!items || items.length === 0) continue;

        const ymd = format(localDate, 'yyyy-MM-dd');

        for (const w of items) {
          const startUtc = this.toUtcFromLocalYmdTime(
            ymd,
            w.startTimeLocal,
            biz.timezone,
          );
          const endUtc = this.toUtcFromLocalYmdTime(
            ymd,
            w.endTimeLocal,
            biz.timezone,
          );

          const overlaps = await this.repo.findOverlappingBookings(
            staffId,
            startUtc,
            endUtc,
            { statuses: ['PENDING', 'CONFIRMED'] },
          );

          if (overlaps.length) {
            conflictsFound += overlaps.length;
            for (const b of overlaps.slice(0, 3)) {
              conflictSamples.push({
                dateLocal: ymd,
                startUtc: startUtc.toISOString(),
                endUtc: endUtc.toISOString(),
                bookingId: (b as any).id,
              });
            }
          }
        }
      }

      if (conflictsFound > 0) {
        throw new BadRequestException({
          message: 'Availability changes conflict with existing bookings',
          conflictsFound,
          samples: conflictSamples,
          hint: 'Use force=true to proceed, then reschedule or cancel affected bookings.',
        });
      }
    }

    const results = await this.db.transaction(async (tx) => {
      const arr: any[] = [];
      for (const it of dto.items) {
        const day = Number(it.dayOfWeek);
        const norm = (t: string) =>
          /^\d{2}:\d{2}:\d{2}$/.test(t) ? t : `${t}:00`;
        arr.push(
          await this.repo.upsertAvailability(
            staffId,
            {
              dayOfWeek: day,
              startTimeLocal: norm(it.startTimeLocal),
              endTimeLocal: norm(it.endTimeLocal),
            },
            tx,
          ),
        );
      }

      await this.audit.logInTx(tx, {
        businessId,
        actorUserId,
        action: 'staffAvailability.bulkUpsert',
        entity: 'Staff',
        entityId: staffId,
        meta: this.audit.buildMeta({
          count: dto.items.length,
          forced: force,
        }),
      });

      return arr;
    });

    await this.staffCache.touchAvailability(staffId);

    return results;
  }

  async listAvailability(businessId: string, staffId: string) {
    await this.ensureStaffInBusiness(businessId, staffId);
    return this.staffCache.listAvailability(staffId, async () =>
      this.repo.listAvailability(staffId),
    );
  }

  async deleteAvailability(
    businessId: string,
    staffId: string,
    dayOfWeek: number,
    actorUserId?: string,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);
    const row = await this.repo.deleteAvailability(staffId, dayOfWeek);
    if (!row) throw new NotFoundException('Availability not found');

    await this.audit.log({
      businessId,
      actorUserId,
      action: 'staffAvailability.delete',
      entity: 'Staff',
      entityId: staffId,
      meta: this.audit.buildMeta({ dayOfWeek }),
    });

    await this.staffCache.touchAvailability(staffId);
    return row;
  }

  // ========== Time off =============
  async listTimeOff(businessId: string, staffId: string) {
    await this.ensureStaffInBusiness(businessId, staffId);
    return this.staffCache.listTimeOff(staffId, async () =>
      this.repo.listTimeOff(staffId),
    );
  }

  async createTimeOff(
    businessId: string,
    staffId: string,
    dto: CreateTimeOffDto,
    actorUserId?: string,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);

    const startUtc = new Date(dto.startUtc);
    const endUtc = new Date(dto.endUtc);
    this.assertRange(startUtc, endUtc);

    const conflicts = await this.repo.findOverlappingBookings(
      staffId,
      startUtc,
      endUtc,
      { statuses: ['PENDING', 'CONFIRMED'] },
    );

    const force = dto.force === true;

    if (conflicts.length && !force) {
      throw new BadRequestException({
        message: 'Conflicting bookings exist in this time-off range',
        conflicts: conflicts.map((b) => ({
          id: b.id,
          status: b.status,
          startUtc: b.startUtc,
          endUtc: b.endUtc,
          customerName: (b as any).customerName,
        })),
      });
    }

    const row = await this.repo.createTimeOff(staffId, {
      ...dto,
      startUtc,
      endUtc,
    });

    await this.audit.log({
      businessId,
      actorUserId,
      action: 'staffTimeOff.create',
      entity: 'Staff',
      entityId: staffId,
      meta: this.audit.buildMeta({
        timeOffId: row.id,
        startUtc: row.startUtc,
        endUtc: row.endUtc,
        reason: row.reason ?? undefined,
        forced: force,
        conflictsFound: conflicts.length,
      }),
    });

    await this.staffCache.touchTimeOff(staffId);

    return row;
  }

  async deleteTimeOff(
    businessId: string,
    staffId: string,
    timeOffId: string,
    actorUserId?: string,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);
    const row = await this.repo.deleteTimeOff(timeOffId);
    if (!row) throw new NotFoundException('Time off not found');

    await this.audit.log({
      businessId,
      actorUserId,
      action: 'staffTimeOff.delete',
      entity: 'Staff',
      entityId: staffId,
      meta: this.audit.buildMeta({ timeOffId }),
    });

    await this.staffCache.touchTimeOff(staffId);
    return row;
  }

  // ===== Walk-in =====
  async createWalkIn(
    businessId: string,
    staffId: string,
    dto: WalkInBookingDto,
    actorUserId?: string,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);
    const startUtc = new Date(dto.startUtc);
    const endUtc = new Date(dto.endUtc);
    if (!(startUtc < endUtc))
      throw new BadRequestException('startUtc must be < endUtc');

    const created = await this.db.transaction(async (tx) => {
      const conflicts = await this.repo.findBookingConflicts(
        staffId,
        startUtc,
        endUtc,
      );
      let cancelledCount = 0;

      if (conflicts.length && !dto.force) {
        throw new BadRequestException({
          message: 'Conflicting bookings exist',
          conflicts,
        });
      }
      if (conflicts.length && dto.force) {
        const cancelled = await tx
          .update(bookingsTable)
          .set({
            status: 'CANCELLED' as any,
            notes: sql`${bookingsTable.notes} || ' \nAuto-cancelled by owner override.'`,
          })
          .where(
            and(
              eq(bookingsTable.staffId, staffId),
              sql`tstzrange(${bookingsTable.startUtc}, ${bookingsTable.endUtc}, '[)') && tstzrange(${startUtc}, ${endUtc}, '[)')`,
              sql`${bookingsTable.status} IN ('PENDING','CONFIRMED')`,
            ),
          )
          .returning({ id: bookingsTable.id });
        cancelledCount = cancelled.length;
      }

      const [row] = await tx
        .insert(bookingsTable)
        .values({
          businessId,
          staffId,
          serviceId: dto.serviceId,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail ?? null,
          status: 'CONFIRMED' as any,
          startUtc,
          endUtc,
          notes: dto.notes ?? null,
        })
        .returning();

      await this.audit.logInTx(tx, {
        businessId,
        actorUserId,
        action: 'booking.create.walkIn',
        entity: 'Booking',
        entityId: row.id,
        meta: this.audit.buildMeta({
          staffId,
          serviceId: dto.serviceId,
          customerName: dto.customerName,
          startUtc,
          endUtc,
          forced: Boolean(dto.force),
          conflictsFound: conflicts.length,
          cancelledCount,
        }),
      });

      return row;
    });

    return created;
  }

  // ===== Helper =====
  private async ensureStaffInBusiness(businessId: string, staffId: string) {
    const row = await this.repo.findById(staffId, { businessId });
    if (!row) throw new NotFoundException('Staff not found');
  }

  // Parse 'HH:MM[:SS]' into numbers and validate
  private parseLocalTimeOrThrow(hhmmss: string) {
    const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hhmmss);
    if (!m) throw new BadRequestException(`Invalid time format: ${hhmmss}`);
    const h = Number(m[1]),
      min = Number(m[2]),
      s = Number(m[3] ?? 0);
    if (h < 0 || h > 23 || min < 0 || min > 59 || s < 0 || s > 59)
      throw new BadRequestException(`Invalid time components: ${hhmmss}`);
    return { h, min, s };
  }

  private assertRange(start: Date, end: Date, allowEqual = false) {
    if (!(start instanceof Date) || isNaN(start.getTime()))
      throw new BadRequestException('Invalid start date');
    if (!(end instanceof Date) || isNaN(end.getTime()))
      throw new BadRequestException('Invalid end date');
    if (start.getTime() > end.getTime())
      throw new BadRequestException('startUtc must be < endUtc');
    if (!allowEqual && start.getTime() === end.getTime())
      throw new BadRequestException('startUtc and endUtc cannot be equal');
  }

  private assertLocalTimeRange(startHHMMSS: string, endHHMMSS: string) {
    const a = this.parseLocalTimeOrThrow(startHHMMSS);
    const b = this.parseLocalTimeOrThrow(endHHMMSS);
    const aMin = a.h * 60 + a.min + a.s / 60;
    const bMin = b.h * 60 + b.min + b.s / 60;
    if (!(aMin < bMin))
      throw new BadRequestException('startTimeLocal must be < endTimeLocal');
  }

  // detect overlap among many local ranges for the SAME day
  private assertNoOverlapLocalRanges(
    items: Array<{ startTimeLocal: string; endTimeLocal: string }>,
  ) {
    const toMin = (t: string) => {
      const { h, min, s } = this.parseLocalTimeOrThrow(t);
      return h * 60 + min + s / 60;
    };
    const ranges = items
      .map((i) => ({ s: toMin(i.startTimeLocal), e: toMin(i.endTimeLocal) }))
      .sort((x, y) => x.s - y.s);
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i].s < ranges[i - 1].e) {
        throw new BadRequestException(
          'Overlapping availability windows in payload for the same day',
        );
      }
    }
  }

  private toUtcFromLocalYmdTime(ymd: string, time: string, tz: string) {
    const localIso = `${ymd}T${time}`;
    return fromZonedTime(localIso, tz);
  }
}
