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
import { BusinessesCache } from './business.cache';

import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { RedisKeys } from '@app/cache/redis-keys';
import { UnauthorizedAppError } from '@app/common/errors/specialized.errors';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAccessGuard)
@Controller('businesses')
export class BusinessesController {
  constructor(
    private readonly svc: BusinessesService,
    private readonly bizCache: BusinessesCache,
    private readonly rl: RateLimitService,
    private readonly dashboardsvc: DashboardService,
  ) {}

  private getClientIp(req: Request) {
    const xfwd = (req.headers['x-forwarded-for'] as string) || '';
    const first = xfwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0];
    return first || (req.ip ?? req.socket.remoteAddress ?? 'unknown');
  }

  @Post()
  @ResMessage('Business created successfully')
  async create(
    @Body() dto: CreateBusinessDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ip = this.getClientIp(req);
    const okUser = await this.rl.hit(
      RedisKeys.rlBizCreateUser(user.sub),
      12,
      60,
    );
    const okIP = await this.rl.hit(RedisKeys.rlBizCreateIP(ip), 8, 60);
    if (!okUser || !okIP)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    return this.svc
      .createOwnedForUser(user.sub, dto, dto.hours?.items ?? [])
      .then(async (r) => {
        await this.bizCache.bumpListVersion(user.sub);
        return r;
      });
  }

  @Get(':businessId/dashboard')
  @ResMessage('Dashboard overview')
  async getDashboard(@Param() params: BusinessIdDto) {
    const businessId = params.businessId;
    return this.dashboardsvc.getOverview(businessId);
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  @Post(':businessId/hours/replace')
  @ResMessage('Business hours replaced successfully')
  async replaceHours(
    @Param() param: BusinessIdDto,
    @Body() body: BusinessHoursPayloadDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ip = this.getClientIp(req);
    const ok1 = await this.rl.hit(
      RedisKeys.rlBizReplaceHours(param.businessId),
      30,
      60,
    );
    const ok2 = await this.rl.hit(
      RedisKeys.rlBizReplaceHoursIP(param.businessId, ip),
      15,
      60,
    );
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    return this.svc.replaceHours(param.businessId, body.items ?? [], user.sub);
  }

  @Get()
  @ResMessage('Businesses retrieved successfully')
  async list(
    @Query() q: ListBusinessQuery,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ip = this.getClientIp(req);
    const ok = await this.rl.hit(
      RedisKeys.rlBizListUserIP(user.sub, ip),
      180,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');

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
  async getHours(@Param() param: BusinessIdDto, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const ok = await this.rl.hit(
      RedisKeys.rlBizHoursIP(param.businessId, ip),
      240,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');
    return this.svc.listHours(param.businessId);
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get(':businessId')
  @ResMessage('Business retrieved successfully')
  async get(@Param() param: BusinessIdDto, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const ok = await this.rl.hit(
      RedisKeys.rlBizGetIP(param.businessId, ip),
      240,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');
    return await this.svc.get(param.businessId);
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  @Patch(':businessId')
  @ResMessage('Business updated successfully')
  async update(
    @Param() param: BusinessIdDto,
    @Body() dto: UpdateBusinessDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ip = this.getClientIp(req);
    const ok1 = await this.rl.hit(
      RedisKeys.rlBizUpdate(param.businessId),
      60,
      60,
    );
    const ok2 = await this.rl.hit(
      RedisKeys.rlBizUpdateIP(param.businessId, ip),
      30,
      60,
    );
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.update(
      param.businessId,
      dto,
      dto.hours?.items ?? [],
      user.sub,
    );
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER')
  @Delete(':businessId')
  @ResMessage('Business deleted successfully')
  async softDelete(
    @Param() param: BusinessIdDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ip = this.getClientIp(req);
    const ok1 = await this.rl.hit(
      RedisKeys.rlBizDelete(param.businessId),
      30,
      60,
    );
    const ok2 = await this.rl.hit(
      RedisKeys.rlBizDeleteIP(param.businessId, ip),
      20,
      60,
    );
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.softDelete(param.businessId, user.sub);
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER')
  @Post(':businessId/restore')
  @ResMessage('Business restored successfully')
  async restore(
    @Param() param: BusinessIdDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ip = this.getClientIp(req);
    const ok1 = await this.rl.hit(
      RedisKeys.rlBizRestore(param.businessId),
      20,
      60,
    );
    const ok2 = await this.rl.hit(
      RedisKeys.rlBizRestoreIP(param.businessId, ip),
      15,
      60,
    );
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.restore(param.businessId, user.sub);
  }

  @UseGuards(BusinessAccessGuard, RolesGuard)
  @Roles('OWNER')
  @Delete(':businessId/hard')
  @ResMessage('Business permanently deleted successfully')
  async hardDelete(
    @Param() param: BusinessIdDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ip = this.getClientIp(req);
    const ok1 = await this.rl.hit(
      RedisKeys.rlBizDelete(param.businessId),
      20,
      60,
    );
    const ok2 = await this.rl.hit(
      RedisKeys.rlBizDeleteIP(param.businessId, ip),
      10,
      60,
    );
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.hardDelete(param.businessId, user.sub);
  }
}
