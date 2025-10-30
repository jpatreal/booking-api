import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceRepository } from './service.repository';
import { services } from '@app/db/schema';
import { generateUniqueSlug } from '@app/common/utils/slug.util';
import type { DB } from '@app/db';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import { CreateServiceDto } from './dto/create-service.dto';
import { QueryServiceDto } from './dto/query-service.dto';
import { LimitsService } from '@app/billing/limit.service';

@Injectable()
export class ServicesService {
  constructor(
    private readonly repo: ServiceRepository,
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly limits: LimitsService,
  ) {}

  async list(businessId: string, query?: QueryServiceDto) {
    const { q, page, pageSize } = query ?? {};
    const result = await this.repo.paginateServices(
      { businessId, q },
      { page, pageSize },
    );

    const rows = result.rows.map((s) => ({
      ...s,
      price: this.fromCents(s.priceCents),
    }));

    return {
      ...result,
      rows,
    };
  }

  private toCents(v: number | string) {
    const n = typeof v === 'string' ? Number(v) : v;
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  private fromCents(cents: number): number {
    return Math.round((cents / 100 + Number.EPSILON) * 100) / 100;
  }

  async create(businessId: string, dto: CreateServiceDto) {
    await this.limits.assertCanCreateService(businessId);
    const slug = await generateUniqueSlug(this.db, services, dto.name);
    try {
      return await this.repo.insert({
        businessId,
        name: dto.name,
        slug,
        durationMin: dto.durationMin,
        description: dto.description,
        priceCents: this.toCents(dto.price),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (e: any) {
      if (
        e?.code === '23505' &&
        /service_business_slug_uq/i.test(e?.constraint)
      ) {
        throw new ConflictException('Service name already exists.');
      }
      throw e;
    }
  }

  async findOneForBusiness(businessId: string, id: string) {
    const service = await this.repo.findByIdOrThrow(businessId, id);

    return {
      ...service,
      price: this.fromCents(service.priceCents),
    };
  }

  async update(
    businessId: string,
    id: string,
    dto: Partial<{
      name: string;
      description: string;
      durationMin: number;
      priceCents: number;
      isActive: boolean;
      price: number | string;
    }>,
  ) {
    const existing = await this.repo.findByIdOrThrow(businessId, id);

    const slug =
      dto.name && dto.name !== existing.name
        ? await generateUniqueSlug(this.db, services, dto.name)
        : existing.slug;

    const updated = await this.repo.updateById(
      id,
      {
        ...dto,
        priceCents:
          dto.priceCents ??
          (dto.price !== undefined ? +dto.price : existing.priceCents),
        slug,
        updatedAt: new Date(),
      },
      { businessId },
    );

    if (!updated) throw new NotFoundException('Service not found');
    return updated;
  }

  async remove(businessId: string, id: string) {
    return this.repo.softDelete(businessId, id);
  }

  async restore(businessId: string, id: string) {
    return this.repo.restore(businessId, id);
  }

  async hardDelete(businessId: string, id: string) {
    const deleted = await this.repo.deleteById(id, { businessId });
    if (!deleted) throw new NotFoundException('Service not found');
    return deleted;
  }
}
