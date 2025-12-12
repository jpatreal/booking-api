import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { BookingsCache } from './bookings.cache';
import { BookingsClientController } from './bookings-client.controller';
import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { IdempotencyService } from '@app/common/idempotency/idempotency.service';
import { LimitsService } from '@app/billing/limit.service';

@Module({
  providers: [
    BookingsService,
    BookingsRepository,
    BookingsCache,
    RateLimitService,
    IdempotencyService,
    LimitsService,
  ],
  controllers: [BookingsController, BookingsClientController],
})
export class BookingsModule {}
