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
import { AuditLogService } from '@app/audit-log/audit-log.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { CreateBusinessDto } from './dto/create-business.dto';

const OWNER_MANAGER_LIMIT = 2;

@Injectable()
export class BusinessesService {
  constructor(
    private readonly repo: BusinessesRepository,
    private readonly bizCache: BusinessesCache,
    private readonly audit: AuditLogService,
  ) {}

  private summarizeHours(hours: HourItem[] = []) {
    return {
      count: hours.length,
      sample: hours.slice(0, 3),
    };
  }

  async createOwnedForUser(
    userId: string,
    input: CreateBusinessDto,
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

      await this.audit.log({
        businessId: created.id,
        actorUserId: userId,
        action: 'business.create',
        entity: 'Business',
        entityId: created.id,
        meta: this.audit.buildMeta({
          input: {
            name: input.name,
            slug: input.slug,
            timezone: input.timezone,
            logoUrl: input.logoUrl ?? null,
            primaryColor: input.primaryColor ?? '#3b82f6',
            tagline: input.tagline ?? 'Book your appointment in seconds.',
            address: input.address ?? null,
            contact: input.contact ?? null,
          },
          hours: this.summarizeHours(hours),
        }),
      });

      await this.bizCache.bumpListVersion(userId);
      await this.bizCache.invalidateEntity(created.id, created.slug);
      return created;
    } catch (e: any) {
      if (e?.code === '23505') {
        throw new BadRequestException(
          'Slug already exists. Please choose another.',
        );
      }
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

  async update(
    id: string,
    patch: UpdateBusinessDto,
    hours?: HourItem[],
    actorUserId?: string,
  ) {
    try {
      const before = await this.repo.findById(id);
      if (!before) throw new NotFoundException('Business not found');

      await this.repo.update(id, patch);
      if (hours && hours.length > 0) {
        await this.repo.replaceHours(id, hours);
      }
      const withHours = await this.repo.findWithHours(id);

      await this.audit.log({
        businessId: id,
        actorUserId,
        action: 'business.update',
        entity: 'Business',
        entityId: id,
        meta: this.audit.buildMeta({
          patch: {
            ...(patch.name ? { name: patch.name } : {}),
            ...(patch.slug ? { slug: patch.slug } : {}),
            ...(patch.timezone ? { timezone: patch.timezone } : {}),
            ...(patch.contact ? { contact: patch.contact } : {}),
          },
          hours: hours ? this.summarizeHours(hours) : undefined,
          before: {
            name: before.name,
            slug: before.slug,
            timezone: before.timezone,
            plan: before.plan,
            status: before.status,
          },
          after: {
            name: withHours!.name,
            slug: withHours!.slug,
            timezone: withHours!.timezone,
            plan: withHours!.plan,
            status: withHours!.status,
          },
        }),
      });

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

  async replaceHours(
    businessId: string,
    hours: HourItem[],
    actorUserId?: string,
  ) {
    const before = await this.repo.findWithHours(businessId);
    await this.repo.replaceHours(businessId, hours);
    const after = await this.repo.findWithHours(businessId);

    await this.audit.log({
      businessId,
      actorUserId,
      action: 'business.replaceHours',
      entity: 'Business',
      entityId: businessId,
      meta: this.audit.buildMeta({
        before: this.summarizeHours(before?.hours ?? []),
        after: this.summarizeHours(hours),
      }),
    });

    await this.bizCache.invalidateEntity(businessId);
    return after;
  }

  async softDelete(id: string, actorUserId?: string) {
    const row = await this.repo.softDelete(id);

    await this.audit.log({
      businessId: id,
      actorUserId,
      action: 'business.softDelete',
      entity: 'Business',
      entityId: id,
      meta: this.audit.buildMeta({ slug: row.slug }),
    });

    await this.bizCache.invalidateEntity(id, row.slug);
    return row;
  }

  async restore(id: string, actorUserId?: string) {
    const row = await this.repo.restore(id);

    await this.audit.log({
      businessId: id,
      actorUserId,
      action: 'business.restore',
      entity: 'Business',
      entityId: id,
      meta: this.audit.buildMeta({ slug: row.slug }),
    });

    await this.bizCache.invalidateEntity(id, row.slug);
    return row;
  }

  async hardDelete(id: string, actorUserId?: string) {
    const row = await this.repo.hardDelete(id);

    await this.audit.log({
      businessId: id,
      actorUserId,
      action: 'business.hardDelete',
      entity: 'Business',
      entityId: id,
      meta: this.audit.buildMeta({ slug: row.slug }),
    });

    await this.bizCache.invalidateEntity(id, row.slug);
    return row;
  }
}
