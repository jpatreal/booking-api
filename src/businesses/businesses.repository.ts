import { Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { DB } from '@app/db';
import { DRIZZLE } from '@app/db/db.module';
import { businesses, businessHours, memberships } from '@app/db/schema';
import { Inject } from '@nestjs/common';
import { generateUniqueSlug } from '@app/common/utils/slug.util';

export interface CreateBusinessInput {
  name: string;
  slug?: string;
  timezone?: string;
}

export interface UpdateBusinessInput {
  name?: string;
  slug?: string;
  timezone?: string;
}

export interface ListParams {
  q?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export interface HourItem {
  dayOfWeek: number;
  openTimeLocal: string;
  closeTimeLocal: string;
}
export interface ListParams {
  q?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

@Injectable()
export class BusinessesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  private isUuid(id: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  }

  async countOwnedOrManaged(userId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          inArray(memberships.role, ['OWNER', 'MANAGER']),
          isNull(memberships.deletedAt),
        ),
      );
    return Number(row?.count ?? 0);
  }

  async listHours(businessId: string) {
    const exists = await this.findById(businessId);
    if (!exists) throw new NotFoundException('Business not found');
    return this.db.query.businessHours.findMany({
      where: (t, { eq, and, isNull }) =>
        and(eq(t.businessId, businessId), isNull(t.deletedAt)),
      orderBy: (t, { asc }) => [asc(t.dayOfWeek)],
    });
  }

  async replaceHours(businessId: string, items: HourItem[], txIn?: any) {
    const conn = txIn ?? this.db;

    const map = new Map<number, HourItem>();
    for (const it of items ?? []) map.set(it.dayOfWeek, it);
    const unique = Array.from(map.values());

    await conn
      .delete(businessHours)
      .where(eq(businessHours.businessId, businessId));

    if (unique.length === 0) return [];

    const toInsert = unique.map((it) => ({
      businessId,
      dayOfWeek: it.dayOfWeek,
      openTimeLocal: it.openTimeLocal as any,
      closeTimeLocal: it.closeTimeLocal as any,
    }));

    const inserted = await conn
      .insert(businessHours)
      .values(toInsert)
      .returning();
    return inserted;
  }

  async createOwnedWithHours(
    ownerUserId: string,
    input: CreateBusinessInput,
    hours: HourItem[] = [],
  ) {
    const slug = await generateUniqueSlug(this.db, businesses, input.name);

    const biz = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(businesses)
        .values({ name: input.name, slug, timezone: input.timezone ?? 'UTC' })
        .returning();

      await tx.insert(memberships).values({
        userId: ownerUserId,
        businessId: created.id,
        role: 'OWNER',
      });

      if (hours?.length) {
        await this.replaceHours(created.id, hours, tx);
      }

      return created;
    });

    const hrs = await this.listHours(biz.id);
    return { ...biz, hours: hrs };
  }

  async create(input: CreateBusinessInput) {
    const slug = await generateUniqueSlug(this.db, businesses, input.name);

    const [row] = await this.db
      .insert(businesses)
      .values({
        name: input.name,
        slug,
        timezone: input.timezone ?? 'UTC',
      })
      .returning();
    return row;
  }

  async findWithHours(idOrSlug: string) {
    const exists = await this.findById(idOrSlug);
    if (!exists) throw new NotFoundException('Business not found');
    const biz = this.isUuid(idOrSlug)
      ? await this.findById(idOrSlug)
      : await this.findBySlug(idOrSlug);
    if (!biz) return null;
    const hrs = await this.listHours(biz.id);
    return { ...biz, hours: hrs };
  }

  async findById(id: string) {
    const row = await this.db.query.businesses.findFirst({
      where: (t, { eq, and, isNull }) => and(eq(t.id, id), isNull(t.deletedAt)),
      with: {
        hours: {
          columns: { deletedAt: false },
          orderBy: (t, { asc }) => [asc(t.dayOfWeek)],
        },
      },
    });
    return row ?? null;
  }

  async findBySlug(slug: string) {
    const row = await this.db.query.businesses.findFirst({
      where: (t, { eq, isNull }) => and(eq(t.slug, slug), isNull(t.deletedAt)),
    });
    return row ?? null;
  }

  async findByIdOrSlug(idOrSlug: string) {
    return this.isUuid(idOrSlug)
      ? await this.findById(idOrSlug)
      : await this.findBySlug(idOrSlug);
  }

  async findAndGetBusinessTimeZone(id: string) {
    const row = await this.db.query.businesses.findFirst({
      where: (t, { eq, and, isNull }) => and(eq(t.id, id), isNull(t.deletedAt)),
      columns: {
        timezone: true,
      },
    });
    return row;
  }

  async list(user: string, params: ListParams = {}) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const rows = await this.db.query.businesses.findMany({
      where: (t, { and, ilike, or, isNull, inArray, exists, eq }) =>
        and(
          isNull(t.deletedAt),
          params.q
            ? or(ilike(t.name, `%${params.q}%`), ilike(t.slug, `%${params.q}%`))
            : undefined,
          exists(
            this.db
              .select({ one: sql`1` })
              .from(memberships)
              .where(
                and(
                  eq(memberships.businessId, t.id),
                  eq(memberships.userId, user),
                  isNull(memberships.deletedAt),
                ),
              ),
          ),
        ),
      with: {
        hours: {
          columns: {
            dayOfWeek: true,
            openTimeLocal: true,
            closeTimeLocal: true,
          },
          orderBy: (h, { asc }) => [asc(h.dayOfWeek)],
        },
      },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: pageSize,
      offset,
    });

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(businesses)
      .where(
        and(
          params.includeDeleted ? undefined : isNull(businesses.deletedAt),
          params.q
            ? or(
                ilike(businesses.name, `%${params.q}%`),
                ilike(businesses.slug, `%${params.q}%`),
              )
            : undefined,
          exists(
            this.db
              .select({ one: sql`1` })
              .from(memberships)
              .where(
                and(
                  eq(memberships.businessId, businesses.id),
                  eq(memberships.userId, user),
                  isNull(memberships.deletedAt),
                ),
              ),
          ),
        ),
      );

    return {
      data: rows,
      page,
      pageSize,
      total: Number(countRow?.count ?? 0),
    };
  }

  async update(id: string, patch: UpdateBusinessInput) {
    const exists = await this.findById(id);
    if (!exists) throw new NotFoundException('Business not found');

    const [row] = await this.db
      .update(businesses)
      .set({
        name: patch.name ?? exists.name,
        timezone: patch.timezone ?? exists.timezone,
      })
      .where(eq(businesses.id, id))
      .returning();
    return row!;
  }

  async softDelete(id: string) {
    const [row] = await this.db
      .update(businesses)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(businesses.id, id), isNull(businesses.deletedAt)))
      .returning();
    if (!row)
      throw new NotFoundException('Business not found or already deleted');
    return row;
  }

  async restore(id: string) {
    const [row] = await this.db
      .update(businesses)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(businesses.id, id))
      .returning();
    if (!row) throw new NotFoundException('Business not found');
    return row;
  }

  async hardDelete(id: string) {
    const [row] = await this.db
      .delete(businesses)
      .where(eq(businesses.id, id))
      .returning();
    if (!row) throw new NotFoundException('Business not found');
    return row;
  }
}
