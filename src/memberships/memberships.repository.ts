import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, isNull } from 'drizzle-orm';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import {
  memberships as m,
  users as u,
  businesses as b,
  roleEnum,
} from '@app/db/schema';

export type Role = (typeof roleEnum.enumValues)[number];

@Injectable()
export class MembershipsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async listByBusiness(
    businessId: string,
    opts: {
      q?: string;
      page?: number;
      pageSize?: number;
      includeDisabled?: boolean;
    } = {},
  ) {
    const { q, page = 1, pageSize = 20, includeDisabled = false } = opts;
    const offset = (page - 1) * pageSize;

    const baseWhere = and(
      eq(m.businessId, businessId),
      includeDisabled ? undefined : isNull(m.disabledAt),
    );

    const rows = await this.db
      .select({
        id: m.id,
        role: m.role,
        disabledAt: m.disabledAt,
        createdAt: m.createdAt,
        userId: m.userId,
        userEmail: u.email,
      })
      .from(m)
      .leftJoin(u, eq(u.id, m.userId))
      .where(q ? and(baseWhere, ilike(u.email, `%${q}%`)) : baseWhere)
      .orderBy(desc(m.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [{ value: total }] = (await this.db
      .select({ value: count() })
      .from(m)
      .leftJoin(u, eq(u.id, m.userId))
      .where(q ? and(baseWhere, ilike(u.email, `%${q}%`)) : baseWhere)) ?? [
      { value: 0 },
    ];

    return { rows, page, pageSize, total };
  }

  async create(input: { userId: string; businessId: string; role: Role }) {
    const [row] = await this.db
      .insert(m)
      .values({
        userId: input.userId,
        businessId: input.businessId,
        role: input.role,
      })
      .returning();
    return row;
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(m).where(eq(m.id, id));
    return row ?? null;
  }

  async countOwners(businessId: string) {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(m)
      .where(and(eq(m.businessId, businessId), eq(m.role, 'OWNER')));
    return Number(value);
  }

  async updateRole(id: string, role: Role) {
    const [row] = await this.db
      .update(m)
      .set({ role })
      .where(eq(m.id, id))
      .returning();
    return row ?? null;
  }

  async disable(id: string) {
    const [row] = await this.db
      .update(m)
      .set({ disabledAt: new Date() })
      .where(eq(m.id, id))
      .returning();
    return row ?? null;
  }

  async enable(id: string) {
    const [row] = await this.db
      .update(m)
      .set({ disabledAt: null })
      .where(eq(m.id, id))
      .returning();
    return row ?? null;
  }

  async remove(id: string) {
    const [row] = await this.db.delete(m).where(eq(m.id, id)).returning();
    return row ?? null;
  }

  async transferOwnership(opts: {
    businessId: string;
    toMembershipId: string;
    fromMembershipId?: string | null;
  }) {
    return this.db.transaction(async (tx) => {
      const [toRow] = await tx
        .select()
        .from(m)
        .where(
          and(eq(m.id, opts.toMembershipId), eq(m.businessId, opts.businessId)),
        );

      if (!toRow) throw new Error('TARGET_NOT_FOUND');

      if (opts.fromMembershipId) {
        const [fromRow] = await tx
          .select()
          .from(m)
          .where(
            and(
              eq(m.id, opts.fromMembershipId),
              eq(m.businessId, opts.businessId),
            ),
          );
        if (!fromRow) throw new Error('SOURCE_NOT_FOUND');

        await tx.update(m).set({ role: 'MANAGER' }).where(eq(m.id, fromRow.id));
      } else {
        const owners = await tx
          .select({ id: m.id })
          .from(m)
          .where(and(eq(m.businessId, opts.businessId), eq(m.role, 'OWNER')));

        for (const o of owners) {
          if (o.id !== opts.toMembershipId) {
            await tx.update(m).set({ role: 'MANAGER' }).where(eq(m.id, o.id));
          }
        }
      }

      await tx
        .update(m)
        .set({ role: 'OWNER' })
        .where(eq(m.id, opts.toMembershipId));

      return { ok: true };
    });
  }
}
