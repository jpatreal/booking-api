import { Module } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { BusinessesRepository } from './businesses.repository';
import { BusinessesController } from './businesses.controller';
import { BusinessesCache } from './business.cache';
import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';
import { LimitsService } from '@app/billing/limit.service';

@Module({
  providers: [
    BusinessesService,
    BusinessesRepository,
    BusinessesCache,
    RateLimitService,
    DashboardRepository,
    DashboardService,
    LimitsService,
  ],
  exports: [BusinessesService, BusinessesRepository],
  controllers: [BusinessesController],
})
export class BusinessesModule {}
