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
} from '@nestjs/common';
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

@Controller('businesses/:businessId/memberships')
@UseGuards(JwtAccessGuard, BusinessAccessGuard, RolesGuard, BusinessPlanGuard)
export class MembershipsController {
  constructor(private readonly svc: MembershipsService) {}

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get()
  @ResMessage('Memberships list')
  @ResPaginated()
  async list(@Param() param: BizIdDto, @Query() query: QueryParamsDto) {
    return this.svc.list(param.businessId, query);
  }

  @Roles('OWNER', 'MANAGER')
  @Post()
  @ResMessage('Membership created')
  async add(@Param() param: BizIdDto, @Body() body: AddMemberDto) {
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
    return this.svc.changeRole(param.membershipId, body.role);
  }

  @Roles('OWNER', 'MANAGER')
  @Patch(':membershipId/disable')
  @ResMessage('Membership disabled')
  async disable(@Param() param: MembershipIdDto) {
    return this.svc.disable(param.membershipId);
  }

  @Roles('OWNER', 'MANAGER')
  @Patch(':membershipId/enable')
  @ResMessage('Membership enabled')
  async enable(@Param() param: MembershipIdDto) {
    return this.svc.enable(param.membershipId);
  }

  @Roles('OWNER', 'MANAGER')
  @Delete(':membershipId')
  @ResMessage('Membership deleted')
  async remove(@Param() param: MembershipIdDto) {
    return this.svc.remove(param.membershipId);
  }

  @Roles('OWNER', 'MANAGER')
  @Post('transfer-owner')
  @ResMessage('Business ownership transferred')
  async transferOwner(
    @Param() param: BizIdDto,
    @Body() body: TransferOwnerDto,
  ) {
    return this.svc.transferOwnership({
      businessId: param.businessId,
      toMembershipId: body.toMembershipId,
      fromMembershipId: body.fromMembershipId ?? null,
    });
  }
}
