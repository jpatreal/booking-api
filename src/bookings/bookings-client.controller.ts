import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';

import { BookingsService } from './bookings.service';
import { TimeoutInterceptor } from '@app/common/interceptors/timeout.interceptor';
import { ResMessage } from '@app/common/http/response.decorator';
import { UnauthorizedAppError } from '@app/common/errors/specialized.errors';
import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { BookingKeys } from '@app/cache/redis-keys';

import { PublicCreateBookingDto } from './dto/public/public-create-booking.dto';
import { AvailabilityQueryDto } from './dto/public/availability-query.dto';
import { IsUUID } from 'class-validator';
import { IdempotencyService } from '@app/common/idempotency/idempotency.service';

class BizParamDto {
  @IsUUID()
  businessId!: string;
}

@UseInterceptors(new TimeoutInterceptor())
@Controller('public/:businessId/bookings')
export class BookingsClientController {
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

  @Get('availability')
  @ResMessage('Public availability')
  async availability(
    @Param() { businessId }: BizParamDto,
    @Query() q: AvailabilityQueryDto,
    @Req() req: Request,
  ) {
    const ip = this.getIp(req);
    const ok = await this.rl.hit(
      BookingKeys.rlPubAvailIP(businessId, ip),
      300,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');

    return this.svc.publicAvailability(businessId, q);
  }

  @Post()
  @ResMessage('Public booking created')
  async createPublic(
    @Param() { businessId }: BizParamDto,
    @Body() dto: PublicCreateBookingDto,
    @Req() req: Request,
  ) {
    const ip = this.getIp(req);
    const ok = await this.rl.hit(
      BookingKeys.rlPubCreateIP(businessId, ip),
      10,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    const idemKey = String(req.headers['x-idempotency-key'] || '').trim();
    if (!idemKey) throw new BadRequestException('Missing x-idempotency-key');

    if (idemKey) {
      const cacheKey = BookingKeys.idemPublic(businessId, idemKey);
      const { done, inProgress } = await this.idem.begin(cacheKey);
      if (inProgress) {
        throw new UnauthorizedAppError('Duplicate in progress. Retry shortly.');
      }
      if (done) return done;

      try {
        const result = await this.svc.createPublic(businessId, dto);
        await this.idem.complete(cacheKey, result);
        return result;
      } catch (e) {
        await this.idem.clear(cacheKey);
        throw e;
      }
    }

    return this.svc.createPublic(businessId, dto);
  }
}
