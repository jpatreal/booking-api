import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { MembershipInviteService } from './membership-invite.service';

import { CreateInviteDto } from './dto/create-invite.dto';
import {
  AcceptInviteDto,
  ResendInviteDto,
  ResendInviteIdDto,
  VerifyInviteQuery,
} from './dto/resend-invite.dto';
import { BizIdDto } from './dto/memberships.dto';
import { JwtAccessGuard } from '@app/auth/guards/jwt-access.guards';
import { BusinessAccessGuard } from '@app/common/guards/business-access.guard';
import { RolesGuard } from '@app/common/guards/roles.guards';
import { BusinessPlanGuard } from '@app/auth/guards/business-plan.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { ResMessage } from '@app/common/http/response.decorator';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';

import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { RedisKeys } from '@app/cache/redis-keys';
import { UnauthorizedAppError } from '@app/common/errors/specialized.errors';

@UseGuards(JwtAccessGuard, BusinessPlanGuard)
@Controller('businesses/:businessId/memberships/invites')
export class MembershipInvitesController {
  constructor(
    private readonly invites: MembershipInviteService,
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

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  @Post()
  @ResMessage('Invite created successfully')
  async createInvite(
    @Param() param: BizIdDto,
    @Body() body: CreateInviteDto,
    @Req() req: Request,
  ) {
    const ip = this.getClientIp(req);
    const okBiz = await this.rl.hit(
      RedisKeys.rlInvCreateBiz(param.businessId),
      20,
      60,
    );
    const okIP = await this.rl.hit(
      RedisKeys.rlInvCreateIP(param.businessId, ip),
      10,
      60,
    );
    if (!okBiz || !okIP)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.invites.createInvite({
      businessId: param.businessId,
      email: body.email,
      role: body.role,
      ttlHours: body.ttlHours,
      returnTokenForDev: body.returnTokenForDev,
    });
  }

  @Post('accept')
  @ResMessage('Invite accepted')
  async accept(@Body() body: AcceptInviteDto, @CurrentUser() user: any) {
    const ok = await this.rl.hit(RedisKeys.rlInvAcceptUser(user.sub), 15, 60);
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.invites.acceptWithToken(body.token, user.sub);
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Post(':inviteId/resend')
  @ResMessage('Invite resent successfully')
  async resend(
    @Param() param: ResendInviteIdDto,
    @Body() body: ResendInviteDto,
    @Req() req: Request,
  ) {
    const ip = this.getClientIp(req);
    const okBiz = await this.rl.hit(
      RedisKeys.rlInvResendBiz('' + param.businessId),
      30,
      60,
    );
    const okIP = await this.rl.hit(
      RedisKeys.rlInvResendIP('' + param.businessId, ip),
      15,
      60,
    );
    if (!okBiz || !okIP)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.invites.resendInvite({
      inviteId: param.inviteId,
      ttlHours: body.ttlHours,
      returnTokenForDev: body.returnTokenForDev,
    });
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get()
  @ResMessage('Pending invites')
  async listPending(@Param() param: BizIdDto, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const ok = await this.rl.hit(
      RedisKeys.rlInvListIP(param.businessId, ip),
      120,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');
    return this.invites.listPendingByBusiness(param.businessId);
  }

  @Roles('OWNER')
  @Delete(':inviteId')
  @ResMessage('Invite cancelled')
  async cancel(@Param() param: ResendInviteIdDto) {
    const ok = await this.rl.hit(RedisKeys.rlInvCancel(param.inviteId), 30, 60);
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.invites.cancelInvite(param.inviteId);
  }

  @Roles('OWNER', 'MANAGER')
  @Get('verify')
  @ResMessage('Invite verified')
  async verify(@Query() q: VerifyInviteQuery, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const ok = await this.rl.hit(RedisKeys.rlInvVerifyIP(ip), 120, 60);
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');
    const invite = await this.invites.verifyToken(q.token);
    return {
      id: invite.id,
      businessId: invite.businessId,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
    };
  }
}
