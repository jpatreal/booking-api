import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { BookingsService } from './bookings.service';
import { TimeoutInterceptor } from '@app/common/interceptors/timeout.interceptor';
import { JwtAccessGuard } from '@app/auth/guards/jwt-access.guards';
import { BusinessAccessGuard } from '@app/common/guards/business-access.guard';
import { RolesGuard } from '@app/common/guards/roles.guards';
import { Roles } from '@app/common/decorators/roles.decorator';
import { ResMessage, ResPaginated } from '@app/common/http/response.decorator';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { UnauthorizedAppError } from '@app/common/errors/specialized.errors';

import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { BookingKeys } from '@app/cache/redis-keys';

import { BusinessParamDto, IdParamDto } from './dto/id-param.dto';
import { ListBookingsQueryDto } from './dto/list-bookings.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { NoShowBookingDto } from './dto/no-show-booking.dto';
import { CompleteBookingDto } from './dto/complete-booking.dto';
import { IdempotencyService } from '@app/common/idempotency/idempotency.service';

@UseInterceptors(new TimeoutInterceptor())
@UseGuards(JwtAccessGuard, BusinessAccessGuard, RolesGuard)
@Controller('businesses/:businessId/bookings')
export class BookingsController {
  constructor(
    private readonly svc: BookingsService,
    private readonly rl: RateLimitService,
    private readonly idem: IdempotencyService,
  ) {}

  private getIp(req: Request) {
    const xfwd = (req.headers['x-forwarded-for'] as string) || '';
    const first = xfwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0];
    return first || (req.ip ?? req.socket.remoteAddress ?? 'unknown');
  }

  @Get()
  @ResMessage('List bookings')
  @ResMessage('Bookings List')
  @ResPaginated()
  async list(
    @Param() { businessId }: BusinessParamDto,
    @Query() q: ListBookingsQueryDto,
    @Req() req: Request,
  ) {
    const ok = await this.rl.hit(
      BookingKeys.rlStatusIP(this.getIp(req)),
      180,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');
    return this.svc.list(businessId, q);
  }

  @Get(':id')
  @ResMessage('Get booking')
  async get(
    @Param() { businessId, id }: BusinessParamDto & IdParamDto,
    @Req() req: Request,
  ) {
    const ok = await this.rl.hit(
      BookingKeys.rlStatusIP(this.getIp(req)),
      240,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');
    return this.svc.get(businessId, id);
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Post()
  @ResMessage('Booking created')
  async create(
    @Param() { businessId }: BusinessParamDto,
    @Body() dto: CreateBookingDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ip = this.getIp(req);
    const okBiz = await this.rl.hit(`rl:book:create:biz:${businessId}`, 60, 60);
    const okIP = await this.rl.hit(BookingKeys.rlCreateIP(ip), 10, 60);
    if (!okBiz || !okIP)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    const idemKey = String(req.headers['x-idempotency-key'] || '').trim();
    if (idemKey) {
      const cacheKey = BookingKeys.idemAdmin(businessId, idemKey);
      const { done, inProgress } = await this.idem.begin(cacheKey);
      if (inProgress)
        throw new UnauthorizedAppError('Duplicate in progress. Retry shortly.');
      if (done) return done;

      try {
        const result = await this.svc.create(businessId, dto as any, user?.sub);
        await this.idem.complete(cacheKey, result);
        return result;
      } catch (e) {
        await this.idem.clear(cacheKey);
        throw e;
      }
    }
    return this.svc.create(businessId, dto as any, user?.sub);
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Patch(':id/reschedule')
  @ResMessage('Reschedule booking')
  async reschedule(
    @Param() { businessId, id }: BusinessParamDto & IdParamDto,
    @Body() dto: RescheduleBookingDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ip = this.getIp(req);
    const ok1 = await this.rl.hit(
      `rl:book:resched:${businessId}:${id}`,
      60,
      60,
    );
    const ok2 = await this.rl.hit(BookingKeys.rlReschedIP(ip), 20, 60);
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    const idemKey = String(req.headers['x-idempotency-key'] || '').trim();
    if (idemKey) {
      const cacheKey = BookingKeys.idemAdmin(businessId, idemKey + ':' + id);
      const { done, inProgress } = await this.idem.begin(cacheKey);
      if (inProgress)
        throw new UnauthorizedAppError('Duplicate in progress. Retry shortly.');
      if (done) return done;

      try {
        const result = await this.svc.create(businessId, dto as any, user?.sub);
        await this.idem.complete(cacheKey, result);
        return result;
      } catch (e) {
        await this.idem.clear(cacheKey);
        throw e;
      }
    }
    return this.svc.reschedule(businessId, id, dto, user?.sub);
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Post(':id/confirm')
  @ResMessage('Confirm booking')
  async confirm(
    @Param() { businessId, id }: BusinessParamDto & IdParamDto,
    @Body() dto: ConfirmBookingDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      BookingKeys.rlConfirmIP(this.getIp(req)),
      40,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.changeStatus(
      businessId,
      id,
      'CONFIRMED',
      user?.sub,
      dto.note,
    );
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @HttpCode(200)
  @Post(':id/cancel')
  @ResMessage('Cancel booking')
  async cancel(
    @Param() { businessId, id }: BusinessParamDto & IdParamDto,
    @Body() dto: CancelBookingDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      BookingKeys.rlCancelIP(this.getIp(req)),
      40,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.changeStatus(
      businessId,
      id,
      'CANCELLED',
      user?.sub,
      dto.note,
      dto.reason,
    );
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Post(':id/no-show')
  @ResMessage('Mark no-show')
  async noShow(
    @Param() { businessId, id }: BusinessParamDto & IdParamDto,
    @Body() dto: NoShowBookingDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      BookingKeys.rlStatusIP(this.getIp(req)),
      60,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.changeStatus(
      businessId,
      id,
      'NO_SHOW',
      user?.sub,
      dto.note,
    );
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Post(':id/complete')
  @ResMessage('Complete booking')
  async complete(
    @Param() { businessId, id }: BusinessParamDto & IdParamDto,
    @Body() dto: CompleteBookingDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ok = await this.rl.hit(
      BookingKeys.rlStatusIP(this.getIp(req)),
      60,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    return this.svc.changeStatus(
      businessId,
      id,
      'COMPLETED',
      user?.sub,
      dto.note,
    );
  }
}
