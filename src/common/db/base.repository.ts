import { Inject } from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import { and, eq, sql } from 'drizzle-orm';

export type PageParams = { page?: number; pageSize?: number };
export type PageResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};

type AnyDb = DB | any;

export abstract class BaseRepository<
  TTable extends { $inferSelect: any; $inferInsert: any },
> {
  constructor(
    @Inject(DRIZZLE) protected readonly db: DB,
    protected readonly table: TTable,
    protected readonly idCol: any,
  ) {}

  protected buildWhere(_args?: any): any {
    return undefined;
  }

  protected getDb(dbOrTx?: AnyDb): AnyDb {
    return dbOrTx ?? this.db;
  }

  async paginate<TSelect = TTable['$inferSelect']>(
    args: any,
    pageParams?: PageParams,
    options?: {
      orderBy?: (t: TTable) => any[];
      selectShape?: (t: TTable) => Record<string, any>;
      dbOrTx?: AnyDb;
    },
  ): Promise<PageResult<TSelect>> {
    const page = pageParams?.page ?? 1;
    const pageSize = pageParams?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const dbi = this.getDb(options?.dbOrTx);
    const where = this.buildWhere(args);
    const orderExprs = options?.orderBy?.(this.table);

    const baseSel = options?.selectShape
      ? dbi.select(options.selectShape(this.table)).from(this.table as any)
      : dbi.select().from(this.table as any);

    let q = baseSel.where(where);

    if (orderExprs && orderExprs.length) {
      q = q.orderBy(...orderExprs);
    }

    const rows = await q.limit(pageSize).offset(offset);

    const [{ count }] = await dbi
      .select({ count: sql<number>`count(*)` })
      .from(this.table as any)
      .where(where);

    return {
      rows: rows as TSelect[],
      total: Number(count) || 0,
      page,
      pageSize,
    };
  }

  async findById<TSelect = TTable['$inferSelect']>(
    id: string,
    args?: any,
    dbOrTx?: AnyDb,
  ): Promise<TSelect | null> {
    const dbi = this.getDb(dbOrTx);
    const where = and(this.buildWhere(args), this.idEq(id));

    const [row] = await dbi
      .select()
      .from(this.table as any)
      .where(where)
      .limit(1);

    return (row as TSelect) ?? null;
  }

  async insert(
    value: TTable['$inferInsert'],
    dbOrTx?: AnyDb,
  ): Promise<TTable['$inferSelect']> {
    const dbi = this.getDb(dbOrTx);
    const [created] = await dbi
      .insert(this.table as any)
      .values(value)
      .returning();
    return created;
  }

  async updateById(
    id: string,
    value: Partial<TTable['$inferInsert']>,
    args?: any,
    dbOrTx?: AnyDb,
  ): Promise<TTable['$inferSelect'] | null> {
    const dbi = this.getDb(dbOrTx);
    const where = and(this.buildWhere(args), this.idEq(id));

    const [updated] = await dbi
      .update(this.table as any)
      .set(value)
      .where(where)
      .returning();

    return updated ?? null;
  }

  async deleteById(
    id: string,
    args?: any,
    dbOrTx?: AnyDb,
  ): Promise<TTable['$inferSelect'] | null> {
    const dbi = this.getDb(dbOrTx);
    const where = and(this.buildWhere(args), this.idEq(id));

    const [deleted] = await dbi
      .delete(this.table as any)
      .where(where)
      .returning();
    return deleted ?? null;
  }

  async softDelete(
    id: string,
    args?: any,
    dbOrTx?: AnyDb,
  ): Promise<TTable['$inferSelect'] | null> {
    const dbi = this.getDb(dbOrTx);
    const where = and(this.buildWhere(args), this.idEq(id));

    const [deleted] = await dbi
      .update(this.table as any)
      .set({ deletedAt: new Date() } as any)
      .where(where)
      .returning();
    return deleted ?? null;
  }

  protected idEq(id: string) {
    return eq(this.idCol, id);
  }
}
