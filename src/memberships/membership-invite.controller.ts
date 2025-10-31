import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

@UseGuards(JwtAccessGuard, BusinessPlanGuard)
@Controller('businesses/:businessId/memberships/invites')
export class MembershipInvitesController {
  constructor(private readonly invites: MembershipInviteService) {}

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  @Post()
  @ResMessage('Invite created successfully')
  async createInvite(@Param() param: BizIdDto, @Body() body: CreateInviteDto) {
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
    return this.invites.acceptWithToken(body.token, user.sub);
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Post(':inviteId/resend')
  @ResMessage('Invite resent successfully')
  async resend(
    @Param() param: ResendInviteIdDto,
    @Body() body: ResendInviteDto,
  ) {
    return this.invites.resendInvite({
      inviteId: param.inviteId,
      ttlHours: body.ttlHours,
      returnTokenForDev: body.returnTokenForDev,
    });
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get()
  @ResMessage('Pending invites')
  async listPending(@Param() param: BizIdDto) {
    return this.invites.listPendingByBusiness(param.businessId);
  }

  @Roles('OWNER')
  @Delete(':inviteId')
  @ResMessage('Invite cancelled')
  async cancel(@Param() param: ResendInviteIdDto) {
    return this.invites.cancelInvite(param.inviteId);
  }

  @Roles('OWNER', 'MANAGER')
  @Get('verify')
  @ResMessage('Invite verified')
  async verify(@Query() q: VerifyInviteQuery) {
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
