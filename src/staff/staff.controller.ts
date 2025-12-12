import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import {
  ListStaffQueryDto,
  CreateStaffDto,
  UpdateStaffDto,
  BulkUpsertStaffServicesDto,
  BulkUpsertAvailabilityDto,
  CreateTimeOffDto,
  WalkInBookingDto,
  StaffParamDto,
  StaffServiceParamDto,
  StaffAvailabilityDto,
  StaffTimeOffDto,
  UpdateStaffServiceOverridesDto,
} from './dto/staff.dto';
import { JwtAccessGuard } from '@app/auth/guards/jwt-access.guards';
import { BusinessAccessGuard } from '@app/common/guards/business-access.guard';
import { RolesGuard } from '@app/common/guards/roles.guards';
import { Roles } from '@app/common/decorators/roles.decorator';
import { ResMessage, ResPaginated } from '@app/common/http/response.decorator';
import { BusinessIdDto } from '@app/services/dto/params-service.dto';
import { BusinessPlanGuard } from '@app/auth/guards/business-plan.guard';
import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { Request } from 'express';
import { RedisKeys } from '@app/cache/redis-keys';
import { UnauthorizedAppError } from '@app/common/errors/specialized.errors';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';

@UseGuards(JwtAccessGuard, BusinessAccessGuard, RolesGuard, BusinessPlanGuard)
@Controller('businesses/:businessId/staff')
export class StaffController {
  constructor(
    private readonly service: StaffService,
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

  // =============================== CRUD ===============================
  @Roles('OWNER', 'MANAGER')
  @Get()
  @ResMessage('Staff list')
  @ResPaginated()
  async list(
    @Param() params: BusinessIdDto,
    @Query() q: ListStaffQueryDto,
    @Req() req: Request,
  ) {
    const ip = this.getClientIp(req);
    const ok = await this.rl.hit(
      RedisKeys.rlStaffListIP(params.businessId, ip),
      60,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');
    return this.service.list(params.businessId, q);
  }

  @Roles('OWNER', 'MANAGER')
  @Post()
  @ResMessage('Staff created')
  async create(
    @Param() params: BusinessIdDto,
    @Body() dto: CreateStaffDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ip = this.getClientIp(req);
    const okBiz = await this.rl.hit(
      RedisKeys.rlStaffCreateBiz(params.businessId),
      30,
      60,
    );
    const okIP = await this.rl.hit(
      RedisKeys.rlStaffCreateIP(params.businessId, ip),
      10,
      60,
    );
    if (!okBiz || !okIP)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.service.create(params.businessId, dto, user.sub);
  }

  @Roles('OWNER', 'MANAGER')
  @ResMessage('Staff data')
  @Get(':staffId')
  async get(@Param() params: StaffParamDto, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const ok = await this.rl.hit(
      RedisKeys.rlStaffGetIP(params.businessId, ip),
      120,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');
    return this.service.get(params.businessId, params.staffId);
  }

  @Roles('OWNER', 'MANAGER')
  @Patch(':staffId')
  @ResMessage('Staff updated')
  async update(
    @Param() params: StaffParamDto,
    @Body() dto: UpdateStaffDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ip = this.getClientIp(req);
    const ok1 = await this.rl.hit(
      RedisKeys.rlStaffUpdate(params.businessId, params.staffId),
      60,
      60,
    );
    const ok2 = await this.rl.hit(
      RedisKeys.rlStaffUpdateIP(params.businessId, params.staffId, ip),
      20,
      60,
    );
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.service.update(
      params.businessId,
      params.staffId,
      dto,
      user.sub,
    );
  }

  @Roles('OWNER', 'MANAGER')
  @Delete(':staffId')
  @ResMessage('Staff deleted')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param() params: StaffParamDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ip = this.getClientIp(req);
    const ok1 = await this.rl.hit(
      RedisKeys.rlStaffDelete(params.businessId, params.staffId),
      30,
      60,
    );
    const ok2 = await this.rl.hit(
      RedisKeys.rlStaffDeleteIP(params.businessId, params.staffId, ip),
      10,
      60,
    );
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.service.remove(params.businessId, params.staffId, user.sub);
  }

  // ============================== Services ===============================
  @Get(':staffId/services')
  @ResMessage('Staff services')
  listServices(@Param() params: StaffParamDto) {
    return this.service.listStaffServices(params.businessId, params.staffId);
  }

  @Roles('OWNER', 'MANAGER')
  @Patch(':staffId/services/:serviceId')
  @ResMessage('Staff service overrides updated')
  async updateServiceOverrides(
    @Param() params: StaffServiceParamDto,
    @Body() dto: UpdateStaffServiceOverridesDto,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      RedisKeys.rlStaffSvcOverride(params.staffId),
      60,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    return this.service.updateStaffServiceOverrides(
      params.businessId,
      params.staffId,
      params.serviceId,
      dto,
      user.sub,
    );
  }

  @Roles('OWNER', 'MANAGER')
  @Put(':staffId/services')
  @ResMessage('Staff services upserted')
  async bulkUpsertServices(
    @Param() params: StaffParamDto,
    @Body() dto: BulkUpsertStaffServicesDto,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      RedisKeys.rlStaffSvcUpsert(params.staffId),
      60,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.service.bulkUpsertServices(
      params.businessId,
      params.staffId,
      dto,
      user.sub,
    );
  }

  @Roles('OWNER', 'MANAGER')
  @Delete(':staffId/services/:serviceId')
  @ResMessage('Staff service removed')
  async deleteService(
    @Param() params: StaffServiceParamDto,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      RedisKeys.rlStaffSvcDelete(params.staffId, params.serviceId),
      30,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.service.deleteStaffService(
      params.businessId,
      params.staffId,
      params.serviceId,
      user.sub,
    );
  }

  // ============================ Availability ============================
  @Get(':staffId/availability')
  @ResMessage('Availability list')
  listAvailability(@Param() params: StaffParamDto) {
    return this.service.listAvailability(params.businessId, params.staffId);
  }

  @Roles('OWNER', 'MANAGER')
  @Put(':staffId/availability')
  @ResMessage('Availability upserted')
  async bulkUpsertAvailability(
    @Param() params: StaffParamDto,
    @Body() dto: BulkUpsertAvailabilityDto,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      RedisKeys.rlStaffAvailUpsert(params.staffId),
      60,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.service.bulkUpsertAvailability(
      params.businessId,
      params.staffId,
      dto,
      user.sub,
    );
  }

  @Roles('OWNER', 'MANAGER')
  @Delete(':staffId/availability/:dayOfWeek')
  @ResMessage('Availability removed')
  async deleteAvailability(
    @Param() params: StaffAvailabilityDto,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      RedisKeys.rlStaffAvailDel(params.staffId, parseInt(params.dayOfWeek, 10)),
      60,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.service.deleteAvailability(
      params.businessId,
      params.staffId,
      parseInt(params.dayOfWeek, 10),
      user.sub,
    );
  }

  // ============================= Time Off ==============================
  @Get(':staffId/time-off')
  @ResMessage('Time off list')
  listTimeOff(@Param() params: StaffParamDto) {
    return this.service.listTimeOff(params.businessId, params.staffId);
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Post(':staffId/time-off')
  @ResMessage('Time off created')
  async createTimeOff(
    @Param() params: StaffParamDto,
    @Body() dto: CreateTimeOffDto,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      RedisKeys.rlStaffToCreate(params.staffId),
      30,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.service.createTimeOff(
      params.businessId,
      params.staffId,
      dto,
      user.sub,
    );
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Delete(':staffId/time-off/:timeOffId')
  @ResMessage('Time off deleted')
  async deleteTimeOff(
    @Param() params: StaffTimeOffDto,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      RedisKeys.rlStaffToDelete(params.staffId, params.timeOffId),
      60,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.service.deleteTimeOff(
      params.businessId,
      params.staffId,
      params.timeOffId,
      user.sub,
    );
  }

  // ============================= Walk-In ==============================
  @Roles('OWNER', 'MANAGER')
  @Post(':staffId/walk-in')
  @ResMessage('Walk-in booked')
  async walkIn(
    @Param() params: StaffParamDto,
    @Body() dto: WalkInBookingDto,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      RedisKeys.rlStaffWalkIn(params.staffId),
      30,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.service.createWalkIn(
      params.businessId,
      params.staffId,
      dto,
      user.sub,
    );
  }
}
