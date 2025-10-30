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
} from './dto/staff.dto';
import { JwtAccessGuard } from '@app/auth/guards/jwt-access.guards';
import { BusinessAccessGuard } from '@app/common/guards/business-access.guard';
import { RolesGuard } from '@app/common/guards/roles.guards';
import { Roles } from '@app/common/decorators/roles.decorator';
import { ResMessage, ResPaginated } from '@app/common/http/response.decorator';
import { BusinessIdDto } from '@app/services/dto/params-service.dto';
import { BusinessPlanGuard } from '@app/auth/guards/business-plan.guard';

@UseGuards(JwtAccessGuard, BusinessAccessGuard, RolesGuard, BusinessPlanGuard)
@Controller('businesses/:businessId/staff')
export class StaffController {
  constructor(private readonly service: StaffService) {}

  // =============================== CRUD ===============================
  @Roles('OWNER', 'MANAGER')
  @Get()
  @ResMessage('Staff list')
  @ResPaginated()
  list(@Param() params: BusinessIdDto, @Query() q: ListStaffQueryDto) {
    return this.service.list(params.businessId, q);
  }

  @Roles('OWNER', 'MANAGER')
  @Post()
  @ResMessage('Staff created')
  create(@Param() params: BusinessIdDto, @Body() dto: CreateStaffDto) {
    return this.service.create(params.businessId, dto);
  }

  @Roles('OWNER', 'MANAGER')
  @ResMessage('Staff data')
  @Get(':staffId')
  get(@Param() params: StaffParamDto) {
    return this.service.get(params.businessId, params.staffId);
  }

  @Roles('OWNER', 'MANAGER')
  @Patch(':staffId')
  @ResMessage('Staff updated')
  update(@Param() params: StaffParamDto, @Body() dto: UpdateStaffDto) {
    return this.service.update(params.businessId, params.staffId, dto);
  }

  @Roles('OWNER', 'MANAGER')
  @Delete(':staffId')
  @ResMessage('Staff deleted')
  @HttpCode(HttpStatus.OK)
  remove(@Param() params: StaffParamDto) {
    return this.service.remove(params.businessId, params.staffId);
  }

  // ============================== Services ===============================
  @Get(':staffId/services')
  @ResMessage('Staff services')
  listServices(@Param() params: StaffParamDto) {
    return this.service.listStaffServices(params.businessId, params.staffId);
  }

  @Put(':staffId/services')
  @ResMessage('Staff services upserted')
  bulkUpsertServices(
    @Param() params: StaffParamDto,
    @Body() dto: BulkUpsertStaffServicesDto,
  ) {
    return this.service.bulkUpsertServices(
      params.businessId,
      params.staffId,
      dto,
    );
  }

  @Delete(':staffId/services/:serviceId')
  @ResMessage('Staff service removed')
  deleteService(@Param() params: StaffServiceParamDto) {
    return this.service.deleteStaffService(
      params.businessId,
      params.staffId,
      params.serviceId,
    );
  }

  // ============================ Availability ============================
  @Get(':staffId/availability')
  @ResMessage('Availability list')
  listAvailability(@Param() params: StaffParamDto) {
    return this.service.listAvailability(params.businessId, params.staffId);
  }

  @Put(':staffId/availability')
  @ResMessage('Availability upserted')
  bulkUpsertAvailability(
    @Param() params: StaffParamDto,
    @Body() dto: BulkUpsertAvailabilityDto,
  ) {
    return this.service.bulkUpsertAvailability(
      params.businessId,
      params.staffId,
      dto,
    );
  }

  @Delete(':staffId/availability/:dayOfWeek')
  @ResMessage('Availability removed')
  deleteAvailability(@Param() params: StaffAvailabilityDto) {
    return this.service.deleteAvailability(
      params.businessId,
      params.staffId,
      parseInt(params.dayOfWeek, 10),
    );
  }

  // ============================= Time Off ==============================
  @Get(':staffId/time-off')
  @ResMessage('Time off list')
  listTimeOff(@Param() params: StaffParamDto) {
    return this.service.listTimeOff(params.businessId, params.staffId);
  }

  @Post(':staffId/time-off')
  @ResMessage('Time off created')
  createTimeOff(@Param() params: StaffParamDto, @Body() dto: CreateTimeOffDto) {
    return this.service.createTimeOff(params.businessId, params.staffId, dto);
  }

  @Delete(':staffId/time-off/:timeOffId')
  @ResMessage('Time off deleted')
  deleteTimeOff(@Param() params: StaffTimeOffDto) {
    return this.service.deleteTimeOff(
      params.businessId,
      params.staffId,
      params.timeOffId,
    );
  }

  // ============================= Walk-In ==============================
  @Post(':staffId/walk-in')
  @ResMessage('Walk-in booked')
  walkIn(@Param() params: StaffParamDto, @Body() dto: WalkInBookingDto) {
    return this.service.createWalkIn(params.businessId, params.staffId, dto);
  }
}
