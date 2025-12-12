import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import {
  bookings,
  bookingStatusHistory,
  staffTimeOff,
  customers,
  outbox,
  auditLog,
  services,
  staff,
  staffServices,
  businessHours,
} from '@app/db/schema';
import {
  and,
  eq,
  sql,
  inArray,
  ne,
  isNull,
  lt,
  gt,
  gte,
  lte,
  ilike,
} from 'drizzle-orm';

type Status = typeof bookings.$inferSelect.status;

@Injectable()
export class BookingsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async outboxInTx(
    tx: any,
    topic: 'booking.created' | 'booking.status.changed' | 'booking.rescheduled',
    payload: Record<string, any>,
  ) {
    await tx.insert(outbox).values({
      topic,
      payload,
    });
  }

  async getBusiness(businessId: string) {
    const row = await this.db.query.businesses.findFirst({
      where: (t, { eq }) => eq(t.id, businessId),
    });
    return row || null;
  }

  async getService(businessId: string, serviceId: string) {
    return await this.db.query.services.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.id, serviceId), eq(t.businessId, businessId)),
    });
  }

  async getStaff(businessId: string, staffId: string) {
    return await this.db.query.staff.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.id, staffId), eq(t.businessId, businessId)),
    });
  }

  async staffOffersService(staffId: string, serviceId: string) {
    return await this.db.query.staffServices.findFirst({
      where: (t, { and, eq, isNull }) =>
        and(
          eq(t.staffId, staffId),
          eq(t.serviceId, serviceId),
          isNull(t.deletedAt),
        ),
    });
  }

  async getBusinessHours(businessId: string) {
    return await this.db.query.businessHours.findMany({
      where: (t, { eq, isNull }) =>
        and(eq(t.businessId, businessId), isNull(t.deletedAt)),
    });
  }

  async getStaffAvailability(staffId: string) {
    return await this.db.query.staffAvailability.findMany({
      where: (t, { eq, isNull }) =>
        and(eq(t.staffId, staffId), isNull(t.deletedAt)),
    });
  }

  async getStaffTimeOffInRange(staffId: string, startUtc: Date, endUtc: Date) {
    return await this.db
      .select()
      .from(staffTimeOff)
      .where(
        and(
          eq(staffTimeOff.staffId, staffId),
          lt(staffTimeOff.startUtc, endUtc as any),
          gt(staffTimeOff.endUtc, startUtc as any),
        ),
      );
  }

  async countOverlappingActive(
    staffId: string,
    startUtc: Date,
    endUtc: Date,
    excludeBookingId?: string,
  ) {
    const active: Status[] = ['PENDING', 'CONFIRMED'];
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.staffId, staffId),
          inArray(bookings.status, active as any),
          lt(bookings.startUtc, endUtc as any),
          gt(bookings.endUtc, startUtc as any),
          excludeBookingId ? ne(bookings.id, excludeBookingId) : sql`true`,
          isNull(bookings.deletedAt),
        ),
      );
    return Number(row?.count ?? 0);
  }

  async insertBooking(
    payload: typeof bookings.$inferInsert,
    actorUserId?: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(bookings).values(payload).returning();

      await tx.insert(bookingStatusHistory).values({
        bookingId: created.id,
        fromStatus: null,
        toStatus: created.status,
        changedByUserId: actorUserId ?? null,
        note: 'created',
      });

      await tx.insert(auditLog).values({
        businessId: created.businessId,
        actorUserId: actorUserId ?? null,
        action: 'create',
        entity: 'Booking',
        entityId: created.id,
        meta: {
          status: created.status,
          startUtc: created.startUtc,
          endUtc: created.endUtc,
          staffId: created.staffId,
          serviceId: created.serviceId,
        } as any,
      });

      await tx.insert(outbox).values({
        topic: 'booking.created',
        payload: {
          bookingId: created.id,
          businessId: created.businessId,
          staffId: created.staffId,
          serviceId: created.serviceId,
          startUtc: created.startUtc,
          endUtc: created.endUtc,
        } as any,
      });

      return created;
    });
  }

  async insertBookingInTx(tx: any, values: typeof bookings.$inferInsert) {
    const [row] = await tx.insert(bookings).values(values).returning();
    return row;
  }

  async getById(businessId: string, id: string) {
    return await this.db.query.bookings.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.id, id), eq(t.businessId, businessId)),
    });
  }

  andDefined(...conds: (any | undefined | false)[]) {
    return and(...(conds.filter(Boolean) as any[]));
  }

  async list(businessId: string, q: any) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const whereCount = this.andDefined(
      eq(bookings.businessId, businessId),
      isNull(bookings.deletedAt),
      q.staffId && eq(bookings.staffId, q.staffId),
      q.serviceId && eq(bookings.serviceId, q.serviceId),
      q.customerId && eq(bookings.customerId, q.customerId),
      q.status && eq(bookings.status, q.status),
      q.startUtcFrom && gte(bookings.startUtc, new Date(q.startUtcFrom)),
      q.startUtcTo && lte(bookings.startUtc, new Date(q.startUtcTo)),
      q.q && ilike(bookings.customerName, `%${q.q}%`),
    );

    const whereRows = (t: typeof bookings, ops: any) =>
      this.andDefined(
        ops.eq(t.businessId, businessId),
        ops.isNull(t.deletedAt),
        q.staffId && ops.eq(t.staffId, q.staffId),
        q.serviceId && ops.eq(t.serviceId, q.serviceId),
        q.customerId && ops.eq(t.customerId, q.customerId),
        q.status && ops.eq(t.status, q.status),
        q.startUtcFrom && ops.gte(t.startUtc, new Date(q.startUtcFrom)),
        q.startUtcTo && ops.lte(t.startUtc, new Date(q.startUtcTo)),
        q.q && ops.ilike(t.customerName, `%${q.q}%`),
      );

    const [rows, [countRow]] = await Promise.all([
      this.db.query.bookings.findMany({
        where: whereRows as any,
        orderBy: (t, { desc }) => [desc(t.startUtc)],
        limit: pageSize,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(whereCount),
    ]);

    const total = Number(countRow?.count ?? 0);
    return {
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasMore: page * pageSize < total,
    };
  }

  async updateStatus(
    businessId: string,
    id: string,
    toStatus: Status,
    byUserId?: string,
    note?: string,
    extraFields?: Partial<typeof bookings.$inferInsert>,
  ) {
    return await this.db.transaction(async (tx) => {
      const b = await tx.query.bookings.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.id, id), eq(t.businessId, businessId)),
      });
      if (!b) return null;

      const fromStatus = b.status;

      const [updated] = await tx
        .update(bookings)
        .set({
          status: toStatus,
          confirmedAt: toStatus === 'CONFIRMED' ? new Date() : b.confirmedAt,
          cancelledAt: toStatus === 'CANCELLED' ? new Date() : b.cancelledAt,
          noShowAt: toStatus === 'NO_SHOW' ? new Date() : b.noShowAt,
          ...extraFields,
          updatedAt: new Date(),
        })
        .where(and(eq(bookings.id, id), eq(bookings.businessId, businessId)))
        .returning();

      await tx.insert(bookingStatusHistory).values({
        bookingId: id,
        fromStatus,
        toStatus,
        changedByUserId: byUserId ?? null,
        note: note ?? null,
      });

      await tx.insert(auditLog).values({
        businessId,
        actorUserId: byUserId ?? null,
        action: 'status.change',
        entity: 'Booking',
        entityId: id,
        meta: { fromStatus, toStatus, note } as any,
      });

      await tx.insert(outbox).values({
        topic: 'booking.status.changed',
        payload: {
          bookingId: id,
          businessId,
          fromStatus,
          toStatus,
        } as any,
      });

      return updated;
    });
  }

  async reschedule(
    businessId: string,
    id: string,
    startUtc: Date,
    endUtc: Date,
    byUserId?: string,
    note?: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const current = await tx.query.bookings.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.id, id), eq(t.businessId, businessId)),
      });
      if (!current) return null;

      const [updated] = await tx
        .update(bookings)
        .set({ startUtc, endUtc, updatedAt: new Date() })
        .where(and(eq(bookings.id, id), eq(bookings.businessId, businessId)))
        .returning();

      await tx.insert(auditLog).values({
        businessId,
        actorUserId: byUserId ?? null,
        action: 'reschedule',
        entity: 'Booking',
        entityId: id,
        meta: {
          from: { startUtc: current.startUtc, endUtc: current.endUtc },
          to: { startUtc, endUtc },
          note,
        } as any,
      });

      await tx.insert(outbox).values({
        topic: 'booking.rescheduled',
        payload: { bookingId: id, businessId, startUtc, endUtc } as any,
      });

      return updated;
    });
  }

  async upsertCustomerIfNeeded(
    businessId: string,
    name: string,
    email?: string,
  ) {
    if (!email) return null;
    const existing = await this.db.query.customers.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.businessId, businessId), eq(t.email, email)),
    });
    if (existing) return existing;

    const [inserted] = await this.db
      .insert(customers)
      .values({ businessId, name, email })
      .onConflictDoNothing()
      .returning();
    return (
      inserted ??
      (await this.db.query.customers.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.businessId, businessId), eq(t.email, email)),
      }))
    );
  }

  async listPublicServices(businessId: string) {
    return this.db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        durationMin: services.durationMin,
        priceCents: services.priceCents,
        capacity: services.capacity,
      })
      .from(services)
      .where(
        and(
          eq(services.businessId, businessId),
          isNull(services.deletedAt),
          eq(services.isActive, true),
        ),
      );
  }

  async listPublicStaffForServices(businessId: string) {
    const rows = await this.db
      .select({
        staffId: staff.id,
        staffName: staff.name,
        avatarUrl: staff.imageUrl,
        bio: staff.bio,
        serviceId: staffServices.serviceId,
      })
      .from(staff)
      .innerJoin(
        staffServices,
        and(
          eq(staffServices.staffId, staff.id),
          isNull(staffServices.deletedAt),
          eq(staffServices.isBookable, true),
        ),
      )
      .where(
        and(
          eq(staff.businessId, businessId),
          isNull(staff.deletedAt),
          eq(staff.isActive, true),
        ),
      );

    const map = new Map<
      string,
      {
        id: string;
        name: string;
        avatarUrl: string | null;
        bio: string | null;
        serviceIds: string[];
      }
    >();

    for (const row of rows) {
      if (!map.has(row.staffId)) {
        map.set(row.staffId, {
          id: row.staffId,
          name: row.staffName,
          avatarUrl: row.avatarUrl ?? null,
          bio: row.bio ?? null,
          serviceIds: [],
        });
      }

      if (row.serviceId) {
        map.get(row.staffId)!.serviceIds.push(row.serviceId);
      }
    }

    return Array.from(map.values());
  }

  async listBusinessHours(businessId: string) {
    return this.db
      .select({
        dayOfWeek: businessHours.dayOfWeek,
        openTimeLocal: businessHours.openTimeLocal,
        closeTimeLocal: businessHours.closeTimeLocal,
      })
      .from(businessHours)
      .where(eq(businessHours.businessId, businessId))
      .orderBy(businessHours.dayOfWeek);
  }

  async listPublicStaffServices(businessId: string) {
    const rows = await this.db
      .select({
        staffId: staffServices.staffId,
        serviceId: staffServices.serviceId,
        priceCentsOverride: staffServices.priceCentsOverride,
        durationMinOverride: staffServices.durationMinOverride,
      })
      .from(staffServices)
      .innerJoin(staff, eq(staffServices.staffId, staff.id))
      .innerJoin(services, eq(staffServices.serviceId, services.id))
      .where(
        and(
          eq(services.businessId, businessId),
          eq(staff.businessId, businessId),
          eq(staffServices.isActive, true),
          eq(staffServices.isBookable, true),
        ),
      );

    return rows;
  }

  async getPublicBookingByReference(businessId: string, reference: string) {
    const rows = await this.db
      .select({
        id: bookings.id,
        businessId: bookings.businessId,
        serviceId: bookings.serviceId,
        staffId: bookings.staffId,
        customerName: bookings.customerName,
        customerEmail: bookings.customerEmail,
        status: bookings.status,
        startUtc: bookings.startUtc,
        endUtc: bookings.endUtc,
        priceCents: bookings.bookedPriceCents,
        notes: bookings.notes,
        serviceName: services.name,
        staffName: staff.name,
      })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(staff, eq(staff.id, bookings.staffId))
      .where(
        and(
          eq(bookings.businessId, businessId),
          eq(bookings.id, reference),
          isNull(bookings.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async getBusinessByIdOrSlug(key: string) {
    return this.db.query.businesses.findFirst({
      where: (b: any, { or, eq }) => or(eq(b.slug, key), eq(b.id, key)),
    });
  }

  async getBusinessBySlug(slug: string) {
    return this.db.query.businesses.findFirst({
      where: (b: any, { eq }) => eq(b.slug, slug),
    });
  }
}
