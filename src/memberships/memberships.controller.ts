import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { MembershipsService } from './memberships.service';
import { JwtAccessGuard } from '@app/auth/guards/jwt-access.guards';
import { BusinessAccessGuard } from '@app/common/guards/business-access.guard';
import { RolesGuard } from '@app/common/guards/roles.guards';
import { BusinessPlanGuard } from '@app/auth/guards/business-plan.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { ResMessage, ResPaginated } from '@app/common/http/response.decorator';
import {
  AddMemberDto,
  BizIdDto,
  MembershipIdDto,
  QueryParamsDto,
  RoleDto,
  TransferOwnerDto,
} from './dto/memberships.dto';

import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { RedisKeys } from '@app/cache/redis-keys';
import { UnauthorizedAppError } from '@app/common/errors/specialized.errors';

@Controller('businesses/:businessId/memberships')
@UseGuards(JwtAccessGuard, BusinessAccessGuard, RolesGuard, BusinessPlanGuard)
export class MembershipsController {
  constructor(
    private readonly svc: MembershipsService,
    private readonly rl: RateLimitService,
  ) {}

  private getClientIp(req: Request) {
    const xfwd = (req.headers['x-forwarded-for'] as string) || '';
    const first = xfwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0];
    return first || (req.ip ?? req.socket.remoteAddress ?? 'unknown');
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get()
  @ResMessage('Memberships list')
  @ResPaginated()
  async list(
    @Param() param: BizIdDto,
    @Query() query: QueryParamsDto,
    @Req() req: Request,
  ) {
    const ip = this.getClientIp(req);
    const ok = await this.rl.hit(
      RedisKeys.rlMemListIP(param.businessId, ip),
      120,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');
    return this.svc.list(param.businessId, query);
  }

  @Roles('OWNER', 'MANAGER')
  @Post()
  @ResMessage('Membership created')
  async add(
    @Param() param: BizIdDto,
    @Body() body: AddMemberDto,
    @Req() req: Request,
  ) {
    const ip = this.getClientIp(req);
    const okBiz = await this.rl.hit(
      RedisKeys.rlMemCreateBiz(param.businessId),
      30,
      60,
    );
    const okIP = await this.rl.hit(
      RedisKeys.rlMemCreateIP(param.businessId, ip),
      10,
      60,
    );
    if (!okBiz || !okIP)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.addMember({
      businessId: param.businessId,
      userId: body.userId,
      role: body.role,
    });
  }

  @Roles('OWNER', 'MANAGER')
  @Patch(':membershipId/role')
  @ResMessage('Membership role changed')
  async changeRole(@Param() param: MembershipIdDto, @Body() body: RoleDto) {
    const ok = await this.rl.hit(
      RedisKeys.rlMemChangeRole(param.membershipId),
      60,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.changeRole(param.membershipId, body.role);
  }

  @Roles('OWNER', 'MANAGER')
  @Patch(':membershipId/disable')
  @ResMessage('Membership disabled')
  async disable(@Param() param: MembershipIdDto) {
    const ok = await this.rl.hit(
      RedisKeys.rlMemDisable(param.membershipId),
      30,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.disable(param.membershipId);
  }

  @Roles('OWNER', 'MANAGER')
  @Patch(':membershipId/enable')
  @ResMessage('Membership enabled')
  async enable(@Param() param: MembershipIdDto) {
    const ok = await this.rl.hit(
      RedisKeys.rlMemEnable(param.membershipId),
      30,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.enable(param.membershipId);
  }

  @Roles('OWNER', 'MANAGER')
  @Delete(':membershipId')
  @ResMessage('Membership deleted')
  async remove(@Param() param: MembershipIdDto) {
    const ok = await this.rl.hit(
      RedisKeys.rlMemDelete(param.membershipId),
      30,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.remove(param.membershipId);
  }

  @Roles('OWNER', 'MANAGER')
  @Post('transfer-owner')
  @ResMessage('Business ownership transferred')
  async transferOwner(
    @Param() param: BizIdDto,
    @Body() body: TransferOwnerDto,
  ) {
    const ok = await this.rl.hit(
      RedisKeys.rlMemTransfer(param.businessId),
      10,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.transferOwnership({
      businessId: param.businessId,
      toMembershipId: body.toMembershipId,
      fromMembershipId: body.fromMembershipId ?? null,
    });
  }
}
