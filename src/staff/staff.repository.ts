import { Injectable } from '@nestjs/common';
import { BaseRepository, PageResult } from '@app/common/db/base.repository';
import type { DB } from '@app/db';
import { and, eq, ilike, isNull, sql, desc } from 'drizzle-orm';
import {
  staff as staffTable,
  staffServices as staffServicesTable,
  staffAvailability as staffAvailabilityTable,
  staffTimeOff as staffTimeOffTable,
  services as servicesTable,
  bookings as bookingsTable,
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
    console.log(activeOnly);
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

  // ── Availability
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

  // ── TimeOff
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

  // ── Walk-in booking helper (find conflicts)
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

  // Custom helpers
  async findByEmail(businessId: string, email: string) {
    const [exist] = await this.db
      .select()
      .from(staffTable)
      .where(
        and(eq(staffTable.businessId, businessId), eq(staffTable.email, email)),
      )
      .limit(1);

    console.log(exist);
    return exist;
  }
}
