import { BadRequestException, Injectable } from '@nestjs/common';
import { MembershipsRepository, Role } from './memberships.repository';
import {
  ConflictAppError,
  ForbiddenAppError,
  NotFoundAppError,
} from '@app/common/errors/specialized.errors';
import { BusinessesRepository } from '@app/businesses/businesses.repository';
import { isUniqueViolation } from '@app/common/errors/pg-like.error';
import { UserRepository } from '@app/users/user.repository';
import { QueryParamsDto } from './dto/memberships.dto';
import { MembershipsCache } from './memberships.cache';

type AddMemberInput =
  | { businessId: string; role: Role; userId: string; email?: never }
  | { businessId: string; role: Role; email: string; userId?: never };

@Injectable()
export class MembershipsService {
  constructor(
    private readonly repo: MembershipsRepository,
    private readonly bizRepo: BusinessesRepository,
    private readonly userRepo: UserRepository,
    private readonly memCache: MembershipsCache,
  ) {}

  async ensureOwnerMembership(userId: string, businessId: string) {
    return await this.repo.ensureOwnerMembership(userId, businessId);
  }

  async list(businessId: string, opts: QueryParamsDto) {
    return this.memCache.getList(
      businessId,
      opts,
      async () => this.repo.listByBusiness(businessId, opts),
      15,
    );
  }

  async addMember(input: AddMemberInput) {
    const biz = await this.bizRepo.findById(input.businessId);
    if (!biz) throw new NotFoundAppError('Business not found');

    let userId: string | undefined =
      'userId' in input ? input.userId : undefined;
    if (!userId && 'email' in input) {
      const user = await this.userRepo.findByEmail(
        input.email.trim().toLowerCase(),
      );
      if (!user)
        throw new NotFoundAppError('User not found. Send an invite instead.');
      userId = user.id;
    }
    if (!userId) throw new BadRequestException('userId or email is required');

    if (input.role === 'OWNER') {
      const owners = await this.memCache.getOwnersCount(input.businessId, () =>
        this.repo.countOwners(input.businessId),
      );
      if (owners > 0)
        throw new ForbiddenAppError('Business already has an owner');
    }

    try {
      const created = await this.repo.create({
        businessId: input.businessId,
        userId,
        role: input.role,
      });

      await this.memCache.invalidateById(created.id);
      await this.memCache.bumpListVer(input.businessId);
      await this.memCache.touchOwners(input.businessId);
      return created;
    } catch (e: any) {
      if (isUniqueViolation(e, 'membership_user_business_uq')) {
        throw new ConflictAppError('User is already a member of this business');
      }
      throw e;
    }
  }

  async changeRole(membershipId: string, role: Role) {
    const row = await this.repo.findById(membershipId);
    if (!row) throw new NotFoundAppError('Membership not found');

    if (row.role === 'OWNER' && role !== 'OWNER') {
      const owners = await this.memCache.getOwnersCount(row.businessId, () =>
        this.repo.countOwners(row.businessId),
      );
      if (owners <= 1) {
        throw new ForbiddenAppError(
          'Cannot demote the last OWNER of the business',
        );
      }
    }

    if (role === 'OWNER') {
      const owners = await this.memCache.getOwnersCount(row.businessId, () =>
        this.repo.countOwners(row.businessId),
      );
      if (owners > 0 && row.role !== 'OWNER') {
        throw new ForbiddenAppError('Business already has an owner');
      }
    }

    const updated = await this.repo.updateRole(membershipId, role);

    await this.memCache.invalidateById(membershipId);
    await this.memCache.bumpListVer(row.businessId);
    await this.memCache.touchOwners(row.businessId);

    return updated;
  }

  async disable(membershipId: string) {
    const row = await this.repo.findById(membershipId);
    if (!row) throw new NotFoundAppError('Membership not found');

    const owners = await this.memCache.getOwnersCount(row.businessId, () =>
      this.repo.countOwners(row.businessId),
    );
    if (row.role === 'OWNER' && owners <= 1) {
      throw new ForbiddenAppError(
        'Cannot disable the last OWNER of the business',
      );
    }

    const res = await this.repo.disable(membershipId);

    await this.memCache.invalidateById(membershipId);
    await this.memCache.bumpListVer(row.businessId);
    await this.memCache.touchOwners(row.businessId);

    return res;
  }

  async enable(membershipId: string) {
    const row = await this.repo.findById(membershipId);
    if (!row) throw new NotFoundAppError('Membership not found');

    const res = await this.repo.enable(membershipId);

    await this.memCache.invalidateById(membershipId);
    await this.memCache.bumpListVer(row.businessId);
    await this.memCache.touchOwners(row.businessId);

    return res;
  }

  async remove(membershipId: string) {
    const row = await this.repo.findById(membershipId);
    if (!row) throw new NotFoundAppError('Membership not found');

    const owners = await this.memCache.getOwnersCount(row.businessId, () =>
      this.repo.countOwners(row.businessId),
    );
    if (row.role === 'OWNER' && owners <= 1) {
      throw new ForbiddenAppError(
        'Cannot remove the last OWNER of the business',
      );
    }

    const res = await this.repo.softDelete(membershipId);

    await this.memCache.invalidateById(membershipId);
    await this.memCache.bumpListVer(row.businessId);
    await this.memCache.touchOwners(row.businessId);

    return res;
  }

  async transferOwnership(input: {
    businessId: string;
    toMembershipId: string;
    fromMembershipId?: string | null;
  }) {
    if (input.fromMembershipId) {
      const [from, to] = await Promise.all([
        this.repo.findById(input.fromMembershipId),
        this.repo.findById(input.toMembershipId),
      ]);
      if (!from) throw new NotFoundAppError('Source membership not found');
      if (!to) throw new NotFoundAppError('Target membership not found');
      if (
        from.businessId !== input.businessId ||
        to.businessId !== input.businessId
      ) {
        throw new BadRequestException(
          'Memberships do not belong to the specified business',
        );
      }
    }

    const res = await this.repo.transferOwnership(input);

    if (input.fromMembershipId)
      await this.memCache.invalidateById(input.fromMembershipId);
    await this.memCache.invalidateById(input.toMembershipId);
    await this.memCache.bumpListVer(input.businessId);
    await this.memCache.touchOwners(input.businessId);

    return res;
  }
}
