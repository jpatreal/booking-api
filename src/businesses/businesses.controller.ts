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
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { BusinessIdDto, ListBusinessQuery } from './dto/list-business.dto';
import { JwtAccessGuard } from '@app/auth/guards/jwt-access.guards';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { BusinessHoursPayloadDto } from './dto/business-hours.dto';
import { ResMessage } from '@app/common/http/response.decorator';
import { BusinessAccessGuard } from '@app/common/guards/business-access.guard';
import { RolesGuard } from '@app/common/guards/roles.guards';
import { Roles } from '@app/common/decorators/roles.decorator';
import { BusinessPlanGuard } from '@app/auth/guards/business-plan.guard';
import { BusinessesCache } from './business.cache';

@UseGuards(JwtAccessGuard, BusinessPlanGuard)
@Controller('businesses')
export class BusinessesController {
  constructor(
    private readonly svc: BusinessesService,
    private readonly bizCache: BusinessesCache,
  ) {}

  @Post()
  @ResMessage('Business created successfully')
  async create(@Body() dto: CreateBusinessDto, @CurrentUser() user: any) {
    return this.svc
      .createOwnedForUser(user.sub, dto, dto.hours?.items ?? [])
      .then(async (r) => {
        await this.bizCache.bumpListVersion(user.sub);
        return r;
      });
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  @Post(':businessId/hours/replace')
  @ResMessage('Business hours replaced successfully')
  replaceHours(
    @Param() param: BusinessIdDto,
    @Body() body: BusinessHoursPayloadDto,
  ) {
    return this.svc.replaceHours(param.businessId, body.items ?? []);
  }

  @Get()
  @ResMessage('Businesses retrieved successfully')
  list(@Query() q: ListBusinessQuery, @CurrentUser() user: any) {
    return this.svc.list(user.sub, {
      q: q.q,
      page: q.page,
      pageSize: q.pageSize,
      includeDeleted: q.includeDeleted === 'true',
    });
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get(':businessId/hours')
  @ResMessage('Business hours retrieved successfully')
  getHours(@Param() param: BusinessIdDto) {
    return this.svc.listHours(param.businessId);
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get(':businessId')
  @ResMessage('Business retrieved successfully')
  async get(@Param() param: BusinessIdDto) {
    return await this.svc.get(param.businessId);
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  @Patch(':businessId')
  @ResMessage('Business updated successfully')
  update(@Param() param: BusinessIdDto, @Body() dto: UpdateBusinessDto) {
    return this.svc.update(param.businessId, dto, dto.hours?.items ?? []);
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER')
  @Delete(':businessId')
  @ResMessage('Business deleted successfully')
  softDelete(@Param() param: BusinessIdDto) {
    return this.svc.softDelete(param.businessId);
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER')
  @Post(':businessId/restore')
  @ResMessage('Business restored successfully')
  restore(@Param() param: BusinessIdDto) {
    return this.svc.restore(param.businessId);
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER')
  @Delete(':businessId/hard')
  @ResMessage('Business permanently deleted successfully')
  hardDelete(@Param() param: BusinessIdDto) {
    return this.svc.hardDelete(param.businessId);
  }
}
