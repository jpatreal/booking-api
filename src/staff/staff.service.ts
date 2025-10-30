import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DB } from '@app/db';
import { DRIZZLE } from '@app/db/db.module';
import { Inject } from '@nestjs/common';
import { StaffRepository } from './staff.repository';
import { staff as staffTable, bookings as bookingsTable } from '@app/db/schema';
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

@Injectable()
export class StaffService {
  constructor(
    private readonly repo: StaffRepository,
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly limits: LimitsService,
  ) {}

  async list(businessId: string, q: ListStaffQueryDto) {
    return this.repo.list(
      { businessId, q: q.q, activeOnly: q.activeOnly },
      q.page,
      q.pageSize,
    );
  }

  async get(businessId: string, staffId: string) {
    const row = await this.repo.findById(staffId, { businessId });
    if (!row) throw new NotFoundException('Staff not found');
    return row;
  }

  async create(businessId: string, dto: CreateStaffDto) {
    await this.limits.assertCanCreateStaff(businessId);
    try {
      return await this.repo.insert({
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
    } catch (e: any) {
      if (isUniqueViolation(e, 'staff_business_email_uq')) {
        throw new ConflictAppError('Email already used in this business');
      }
      if (isUniqueViolation(e, 'staff_business_user_uq')) {
        throw new BadRequestException(
          'User is already a staff member in this business',
        );
      }
      if (isUniqueViolation(e)) {
        throw new ConflictAppError(
          `Unique constraint failed: ${pgConstraint(e) ?? 'unknown'}`,
        );
      }
      throw e;
    }
  }

  async update(businessId: string, staffId: string, dto: UpdateStaffDto) {
    const updated = await this.repo.updateById(
      staffId,
      { ...dto },
      { businessId },
    );
    if (!updated) throw new NotFoundException('Staff not found');
    return updated;
  }

  async remove(businessId: string, staffId: string) {
    const deleted = await this.repo.softDelete(staffId, { businessId });
    if (!deleted) throw new NotFoundException('Staff not found');
    return { deleted: true };
  }

  // ============================== Services ===============================
  async bulkUpsertServices(
    businessId: string,
    staffId: string,
    dto: BulkUpsertStaffServicesDto,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);
    return this.db.transaction(async (tx) => {
      const results = [] as any[];
      for (const item of dto.items) {
        results.push(await this.repo.upsertStaffService(staffId, item, tx));
      }
      return results;
    });
  }

  async listStaffServices(businessId: string, staffId: string) {
    await this.ensureStaffInBusiness(businessId, staffId);
    return this.repo.listStaffServices(staffId);
  }

  async deleteStaffService(
    businessId: string,
    staffId: string,
    serviceId: string,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);
    const row = await this.repo.deleteStaffService(staffId, serviceId);
    if (!row) throw new NotFoundException('Mapping not found');
    return row;
  }

  async bulkUpsertAvailability(
    businessId: string,
    staffId: string,
    dto: BulkUpsertAvailabilityDto,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);
    return this.db.transaction(async (tx) => {
      const results = [] as any[];
      for (const item of dto.items) {
        results.push(await this.repo.upsertAvailability(staffId, item, tx));
      }
      return results;
    });
  }

  // =========================== Availability ============================
  async listAvailability(businessId: string, staffId: string) {
    await this.ensureStaffInBusiness(businessId, staffId);
    return this.repo.listAvailability(staffId);
  }

  async deleteAvailability(
    businessId: string,
    staffId: string,
    dayOfWeek: number,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);
    const row = await this.repo.deleteAvailability(staffId, dayOfWeek);
    if (!row) throw new NotFoundException('Availability not found');
    return row;
  }

  // ============================= Time Off ==============================
  async listTimeOff(businessId: string, staffId: string) {
    await this.ensureStaffInBusiness(businessId, staffId);
    return this.repo.listTimeOff(staffId);
  }

  async createTimeOff(
    businessId: string,
    staffId: string,
    dto: CreateTimeOffDto,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);
    const row = await this.repo.createTimeOff(staffId, dto);
    return row;
  }

  async deleteTimeOff(businessId: string, staffId: string, timeOffId: string) {
    await this.ensureStaffInBusiness(businessId, staffId);
    const row = await this.repo.deleteTimeOff(timeOffId);
    if (!row) throw new NotFoundException('Time off not found');
    return row;
  }

  async createWalkIn(
    businessId: string,
    staffId: string,
    dto: WalkInBookingDto,
  ) {
    await this.ensureStaffInBusiness(businessId, staffId);
    const startUtc = new Date(dto.startUtc);
    const endUtc = new Date(dto.endUtc);
    if (!(startUtc < endUtc))
      throw new BadRequestException('startUtc must be < endUtc');

    return this.db.transaction(async (tx) => {
      const conflicts = await this.repo.findBookingConflicts(
        staffId,
        startUtc,
        endUtc,
      );
      if (conflicts.length && !dto.force) {
        throw new BadRequestException({
          message: 'Conflicting bookings exist',
          conflicts,
        });
      }

      if (conflicts.length && dto.force) {
        await tx
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
          );
      }

      const [created] = await tx
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

      return created;
    });
  }

  // =============================== Helpers ==============================
  private async ensureStaffInBusiness(businessId: string, staffId: string) {
    const row = await this.repo.findById(staffId, { businessId });
    if (!row) throw new NotFoundException('Staff not found');
  }
}
