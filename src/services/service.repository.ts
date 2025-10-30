import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull } from 'drizzle-orm';
import type { DB } from '@app/db';
import { services } from '@app/db/schema';
import { BaseRepository, PageParams } from '@app/common/db/base.repository';
import { NotFoundAppError } from '@app/common/errors/specialized.errors';

export type ServiceFilters = {
  businessId: string;
  q?: string;
  includeDeleted?: boolean;
};

@Injectable()
export class ServiceRepository extends BaseRepository<typeof services> {
  constructor(db: DB) {
    super(db, services, services.id);
  }

  protected buildWhere(f: ServiceFilters) {
    return and(
      eq(services.businessId, f.businessId),
      f.includeDeleted ? undefined : isNull(services.deletedAt),
      f.q ? ilike(services.name, `%${f.q}%`) : undefined,
    );
  }

  async paginateServices(
    filters: ServiceFilters,
    page?: PageParams,
    dbOrTx?: DB,
  ) {
    return this.paginate(filters, page, {
      orderBy: (t) => [desc((t as any).createdAt)],
    });
  }

  async findByIdOrThrow(businessId: string, id: string) {
    const row = await this.findById(id, { businessId, includeDeleted: false });
    if (!row) throw new NotFoundAppError('Service not found', { id });
    return row;
  }

  async softDelete(businessId: string, id: string, dbOrTx?: DB) {
    const updated = await this.updateById(
      id,
      { deletedAt: new Date(), isActive: false, updatedAt: new Date() },
      { businessId },
      dbOrTx,
    );
    if (!updated) throw new NotFoundException('Service not found');
    return updated;
  }

  async restore(businessId: string, id: string, dbOrTx?: DB) {
    const updated = await this.updateById(
      id,
      { deletedAt: null, isActive: true, updatedAt: new Date() },
      { businessId, includeDeleted: true },
      dbOrTx,
    );
    if (!updated) throw new NotFoundException('Service not found');
    return updated;
  }
}
