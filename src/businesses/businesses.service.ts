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

const OWNER_MANAGER_LIMIT = 2;

@Injectable()
export class BusinessesService {
  constructor(private readonly repo: BusinessesRepository) {}

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
      return await this.repo.createOwnedWithHours(userId, input, hours);
    } catch (e: any) {
      if (e?.code === '23505')
        throw new BadRequestException(
          'Slug already exists. Please choose another.',
        );
      throw e;
    }
  }

  get(businessId: string) {
    return this.repo.findWithHours(businessId);
  }

  async require(idOrSlug: string) {
    const row = await this.get(idOrSlug);
    if (!row) throw new NotFoundException('Business not found');
    return row;
  }

  list(user: string, params: ListParams) {
    return this.repo.list(user, params);
  }

  listHours(businessId: string) {
    return this.repo.listHours(businessId);
  }

  async update(id: string, patch: UpdateBusinessInput, hours?: HourItem[]) {
    try {
      await this.repo.update(id, patch);
      if (hours && hours.length > 0) {
        await this.repo.replaceHours(id, hours);
      }
      const withHours = await this.repo.findWithHours(id);
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
    return this.repo.findWithHours(businessId);
  }

  softDelete(id: string) {
    return this.repo.softDelete(id);
  }

  restore(id: string) {
    return this.repo.restore(id);
  }

  hardDelete(id: string) {
    return this.repo.hardDelete(id);
  }
}
