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

type AddMemberInput =
  | { businessId: string; role: Role; userId: string; email?: never }
  | { businessId: string; role: Role; email: string; userId?: never };

@Injectable()
export class MembershipsService {
  constructor(
    private readonly repo: MembershipsRepository,
    private readonly bizRepo: BusinessesRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async ensureOwnerMembership(userId: string, businessId: string) {
    return await this.repo.ensureOwnerMembership(userId, businessId);
  }

  async list(businessId: string, opts: QueryParamsDto) {
    return this.repo.listByBusiness(businessId, opts);
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
      if (!user) {
        throw new NotFoundAppError('User not found. Send an invite instead.');
      }
      userId = user.id;
    }
    if (!userId) throw new BadRequestException('userId or email is required');

    if (input.role === 'OWNER') {
      const owners = await this.repo.countOwners(input.businessId);
      if (owners > 0)
        throw new ForbiddenAppError('Business already has an owner');
    }

    try {
      return await this.repo.create({
        businessId: input.businessId,
        userId,
        role: input.role,
      });
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
      const owners = await this.repo.countOwners(row.businessId);
      if (owners <= 1) {
        throw new ForbiddenAppError(
          'Cannot demote the last OWNER of the business',
        );
      }
    }

    if (role === 'OWNER') {
      const owners = await this.repo.countOwners(row.businessId);
      if (owners > 0 && row.role !== 'OWNER') {
        throw new ForbiddenAppError('Business already has an owner');
      }
    }

    return this.repo.updateRole(membershipId, role);
  }

  async disable(membershipId: string) {
    const row = await this.repo.findById(membershipId);
    if (!row) throw new NotFoundAppError('Membership not found');

    if (row.role === 'OWNER') {
      const owners = await this.repo.countOwners(row.businessId);
      if (owners <= 1) {
        throw new ForbiddenAppError(
          'Cannot disable the last OWNER of the business',
        );
      }
    }

    return this.repo.disable(membershipId);
  }

  async enable(membershipId: string) {
    const row = await this.repo.findById(membershipId);
    if (!row) throw new NotFoundAppError('Membership not found');
    return this.repo.enable(membershipId);
  }

  async remove(membershipId: string) {
    const row = await this.repo.findById(membershipId);
    if (!row) throw new NotFoundAppError('Membership not found');

    if (row.role === 'OWNER') {
      const owners = await this.repo.countOwners(row.businessId);
      if (owners <= 1) {
        throw new ForbiddenAppError(
          'Cannot remove the last OWNER of the business',
        );
      }
    }

    return this.repo.softDelete(membershipId);
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

    return this.repo.transferOwnership(input);
  }
}
