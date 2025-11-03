import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { ServiceRepository } from './service.repository';
import { LimitsModule } from '@app/billing/limits.module';
import { ServicesCache } from './services.cache';
import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';

@Module({
  imports: [LimitsModule],
  controllers: [ServicesController],
  providers: [
    ServicesService,
    ServiceRepository,
    ServicesCache,
    RateLimitService,
  ],
})
export class ServicesModule {}
