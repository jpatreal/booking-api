import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { StaffRepository } from './staff.repository';
import { LimitsModule } from '@app/billing/limits.module';
import { StaffCache } from './staff.cache';
import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { BusinessesRepository } from '@app/businesses/businesses.repository';

@Module({
  imports: [LimitsModule],
  providers: [
    StaffService,
    StaffRepository,
    StaffCache,
    RateLimitService,
    BusinessesRepository,
  ],
  controllers: [StaffController],
})
export class StaffModule {}
