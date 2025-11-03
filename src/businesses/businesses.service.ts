import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessesRepository,
  CreateBusinessInput,
  HourItem,
  ListParams,
  UpdateBusinessInput,
} from './businesses.repository';
import { BusinessesCache } from './business.cache';

const OWNER_MANAGER_LIMIT = 2;

@Injectable()
export class BusinessesService {
  constructor(
    private readonly repo: BusinessesRepository,
    private readonly bizCache: BusinessesCache,
  ) {}

  async createOwnedForUser(
    userId: string,
    input: CreateBusinessInput,
    hours: HourItem[] = [],
  ) {
    const count = await this.repo.countOwnedOrManaged(userId);
    if (count >= OWNER_MANAGER_LIMIT) {
      throw new BadRequestException(
        `Limit reached: you can only own/manage up to ${OWNER_MANAGER_LIMIT} businesses.`,
      );
    }
    try {
      const created = await this.repo.createOwnedWithHours(
        userId,
        input,
        hours,
      );
      await this.bizCache.bumpListVersion(userId);
      await this.bizCache.invalidateEntity(created.id, created.slug);
      return created;
    } catch (e: any) {
      if (e?.code === '23505')
        throw new BadRequestException(
          'Slug already exists. Please choose another.',
        );
      throw e;
    }
  }

  async get(idOrSlug: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      );
    const data = isUuid
      ? await this.bizCache.getById(idOrSlug)
      : await this.bizCache.getBySlug(idOrSlug);
    if (!data) throw new NotFoundException('Business not found');
    return data;
  }

  async require(idOrSlug: string) {
    const row = await this.get(idOrSlug);
    if (!row) throw new NotFoundException('Business not found');
    return row;
  }

  async list(user: string, params: ListParams) {
    return this.bizCache.getList(
      user,
      params,
      async () => await this.repo.list(user, params),
      15,
    );
  }

  async listHours(businessId: string) {
    return this.bizCache.getHours(businessId);
  }

  async update(id: string, patch: UpdateBusinessInput, hours?: HourItem[]) {
    try {
      const before = await this.repo.findById(id);
      if (!before) throw new NotFoundException('Business not found');

      await this.repo.update(id, patch);
      if (hours && hours.length > 0) {
        await this.repo.replaceHours(id, hours);
      }
      const withHours = await this.repo.findWithHours(id);

      await this.bizCache.invalidateEntity(id, before.slug);
      return withHours!;
    } catch (e: any) {
      if (e?.code === '23505')
        throw new BadRequestException(
          'Slug already exists. Please choose another.',
        );
      throw e;
    }
  }

  async replaceHours(businessId: string, hours: HourItem[]) {
    await this.repo.replaceHours(businessId, hours);
    await this.bizCache.invalidateEntity(businessId);
    return this.repo.findWithHours(businessId);
  }

  async softDelete(id: string) {
    const row = await this.repo.softDelete(id);
    await this.bizCache.invalidateEntity(id, row.slug);
    return row;
  }

  async restore(id: string) {
    const row = await this.repo.restore(id);
    await this.bizCache.invalidateEntity(id, row.slug);
    return row;
  }

  async hardDelete(id: string) {
    const row = await this.repo.hardDelete(id);
    await this.bizCache.invalidateEntity(id, row.slug);
    return row;
  }
}
