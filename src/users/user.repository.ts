import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, ilike, or, lt, gt, sql } from 'drizzle-orm';
import type { DB } from '@app/db';
import { users } from '@app/db/schema';
import { BaseRepository } from '@app/common/db/base.repository';
import { NotFoundAppError } from '@app/common/errors/specialized.errors';

export type UserFilters = {
  q?: string;
};

@Injectable()
export class UserRepository extends BaseRepository<typeof users> {
  constructor(db: DB) {
    super(db, users, users.id);
  }

  protected buildWhere(f?: UserFilters) {
    return and(f?.q ? ilike(users.email, `%${f.q.toLowerCase()}%`) : undefined);
  }

  async findByEmail(email: string) {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row ?? null;
  }

  async findByIdOrThrow(id: string) {
    const row = await this.findById(id);
    if (!row) throw new NotFoundAppError('User not found');
    return row;
  }

  async listKeyset(params: {
    q?: string;
    cursor?: string | null;
    take?: number;
  }) {
    const takeRequested = params.take ?? 25;
    const takeAbs = Math.min(Math.max(Math.abs(takeRequested), 1), 100);
    const forward = takeRequested >= 0;

    const baseWhere = this.buildWhere({ q: params.q });

    let cursorPredicate: any = undefined;

    if (params.cursor) {
      const cursorRow = await this.findById(params.cursor);
      if (cursorRow) {
        if (forward) {
          cursorPredicate = or(
            lt(users.createdAt, cursorRow.createdAt),
            and(
              eq(users.createdAt, cursorRow.createdAt),
              lt(users.id, cursorRow.id),
            ),
          );
        } else {
          cursorPredicate = or(
            gt(users.createdAt, cursorRow.createdAt),
            and(
              eq(users.createdAt, cursorRow.createdAt),
              gt(users.id, cursorRow.id),
            ),
          );
        }
      }
    }

    const whereAll = and(baseWhere, cursorPredicate);

    const orderBy = forward
      ? (t: any, { desc }: any) => [desc(t.createdAt), desc(t.id)]
      : (t: any, { asc }: any) => [asc(t.createdAt), asc(t.id)];

    const rows = await this.db.query.users.findMany({
      where: whereAll,
      orderBy,
      limit: takeAbs,
      offset: 0,
      columns: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(baseWhere);

    const nextCursor = rows.length ? rows[rows.length - 1].id : null;

    return {
      items: rows,
      total: Number(count) || 0,
      nextCursor,
    };
  }
}
