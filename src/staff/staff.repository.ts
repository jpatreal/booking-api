import { Injectable } from '@nestjs/common';
import { BaseRepository, PageResult } from '@app/common/db/base.repository';
import type { DB } from '@app/db';
import {
  and,
  eq,
  ilike,
  isNull,
  sql,
  desc,
  inArray,
  lt,
  gt,
} from 'drizzle-orm';
import {
  staff as staffTable,
  staffServices as staffServicesTable,
  staffAvailability as staffAvailabilityTable,
  staffTimeOff as staffTimeOffTable,
  bookings as bookingsTable,
  bookings,
} from '@app/db/schema';

interface ListArgs {
  businessId: string;
  q?: string;
  activeOnly?: boolean;
}

@Injectable()
export class StaffRepository extends BaseRepository<typeof staffTable> {
  constructor(db: DB) {
    super(db, staffTable, staffTable.id);
  }

  protected buildWhere(args?: ListArgs) {
    if (!args) return undefined;
    const { businessId, q, activeOnly } = args;
    return and(
      eq(staffTable.businessId, businessId),
      isNull(staffTable.deletedAt),
      activeOnly ? eq(staffTable.isActive, true) : undefined,
      q ? ilike(staffTable.name, `%${q}%`) : undefined,
    );
  }

  async list(args: ListArgs, page: number, pageSize: number) {
    const result = await this.paginate(
      args,
      { page, pageSize },
      {
        orderBy: () => [
          desc(staffTable.displayOrder),
          desc(staffTable.createdAt),
        ],
      },
    );
    return result as PageResult<typeof staffTable.$inferSelect>;
  }

  async upsertStaffService(staffId: string, item: any, dbOrTx?: DB | any) {
    const dbi = this.getDb(dbOrTx);
    const values = {
      staffId,
      serviceId: item.serviceId,
      isActive: item.isActive ?? true,
      priceCentsOverride: item.priceCentsOverride ?? null,
      durationMinOverride: item.durationMinOverride ?? null,
      bufferBeforeMin: item.bufferBeforeMin ?? 0,
      bufferAfterMin: item.bufferAfterMin ?? 0,
    };
    const [row] = await dbi
      .insert(staffServicesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [staffServicesTable.staffId, staffServicesTable.serviceId],
        set: {
          isActive: values.isActive,
          priceCentsOverride: values.priceCentsOverride,
          durationMinOverride: values.durationMinOverride,
          bufferBeforeMin: values.bufferBeforeMin,
          bufferAfterMin: values.bufferAfterMin,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return row;
  }

  async listStaffServices(staffId: string) {
    return this.db
      .select()
      .from(staffServicesTable)
      .where(eq(staffServicesTable.staffId, staffId));
  }

  async updateStaffServiceOverrides(
    staffId: string,
    serviceId: string,
    overrides: {
      priceCentsOverride?: number | null;
      durationMinOverride?: number | null;
      bufferBeforeMin?: number;
      bufferAfterMin?: number;
      isActive?: boolean;
      isBookable?: boolean;
    },
  ) {
    const patch: Partial<typeof staffServicesTable.$inferInsert> = {};

    if ('priceCentsOverride' in overrides)
      patch.priceCentsOverride = overrides.priceCentsOverride;

    if ('durationMinOverride' in overrides)
      patch.durationMinOverride = overrides.durationMinOverride;

    if ('bufferBeforeMin' in overrides)
      patch.bufferBeforeMin = overrides.bufferBeforeMin;

    if ('bufferAfterMin' in overrides)
      patch.bufferAfterMin = overrides.bufferAfterMin;

    if ('isActive' in overrides) patch.isActive = overrides.isActive;

    if ('isBookable' in overrides) patch.isBookable = overrides.isBookable;

    // nothing to update
    if (Object.keys(patch).length === 0) return null;

    const [row] = await this.db
      .update(staffServicesTable)
      .set(patch)
      .where(
        and(
          eq(staffServicesTable.staffId, staffId),
          eq(staffServicesTable.serviceId, serviceId),
        ),
      )
      .returning();

    return row ?? null;
  }

  async deleteStaffService(staffId: string, serviceId: string) {
    const [row] = await this.db
      .delete(staffServicesTable)
      .where(
        and(
          eq(staffServicesTable.staffId, staffId),
          eq(staffServicesTable.serviceId, serviceId),
        ),
      )
      .returning();
    return row;
  }

  async upsertAvailability(staffId: string, item: any, dbOrTx?: DB | any) {
    const dbi = this.getDb(dbOrTx);
    const values = {
      staffId,
      dayOfWeek: item.dayOfWeek,
      startTimeLocal: item.startTimeLocal,
      endTimeLocal: item.endTimeLocal,
    };
    const [row] = await dbi
      .insert(staffAvailabilityTable)
      .values(values)
      .onConflictDoUpdate({
        target: [
          staffAvailabilityTable.staffId,
          staffAvailabilityTable.dayOfWeek,
        ],
        set: {
          startTimeLocal: values.startTimeLocal,
          endTimeLocal: values.endTimeLocal,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return row;
  }

  async listAvailability(staffId: string) {
    return this.db
      .select()
      .from(staffAvailabilityTable)
      .where(eq(staffAvailabilityTable.staffId, staffId))
      .orderBy(staffAvailabilityTable.dayOfWeek);
  }

  async deleteAvailability(staffId: string, dayOfWeek: number) {
    const [row] = await this.db
      .delete(staffAvailabilityTable)
      .where(
        and(
          eq(staffAvailabilityTable.staffId, staffId),
          eq(staffAvailabilityTable.dayOfWeek, dayOfWeek),
        ),
      )
      .returning();
    return row;
  }

  async createTimeOff(staffId: string, dto: any, dbOrTx?: DB | any) {
    const dbi = this.getDb(dbOrTx);
    const [row] = await dbi
      .insert(staffTimeOffTable)
      .values({
        staffId,
        startUtc: new Date(dto.startUtc),
        endUtc: new Date(dto.endUtc),
        reason: dto.reason ?? null,
      })
      .returning();
    return row;
  }

  async listTimeOff(staffId: string) {
    return this.db
      .select()
      .from(staffTimeOffTable)
      .where(eq(staffTimeOffTable.staffId, staffId))
      .orderBy(desc(staffTimeOffTable.startUtc));
  }

  async deleteTimeOff(id: string) {
    const [row] = await this.db
      .delete(staffTimeOffTable)
      .where(eq(staffTimeOffTable.id, id))
      .returning();
    return row;
  }

  async findOverlappingBookings(
    staffId: string,
    startUtc: Date,
    endUtc: Date,
    opts: { statuses: string[]; includeBuffers?: boolean },
  ) {
    return this.db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.staffId, staffId),
          inArray(bookings.status, ['PENDING', 'CONFIRMED']),
          isNull(bookings.deletedAt),
          lt(bookings.startUtc, endUtc),
          gt(bookings.endUtc, startUtc),
        ),
      );
  }

  async findBookingConflicts(staffId: string, startUtc: Date, endUtc: Date) {
    const range = sql`tstzrange(${startUtc}, ${endUtc}, '[)')`;
    return this.db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.staffId, staffId),
          sql`tstzrange(${bookingsTable.startUtc}, ${bookingsTable.endUtc}, '[)') && ${range}`,
          sql`${bookingsTable.status} IN ('PENDING','CONFIRMED')`,
        ),
      );
  }

  async findByEmail(businessId: string, email: string) {
    const [exist] = await this.db
      .select()
      .from(staffTable)
      .where(
        and(eq(staffTable.businessId, businessId), eq(staffTable.email, email)),
      )
      .limit(1);

    return exist;
  }
}
