import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { ServiceRepository } from './service.repository';
import { LimitsModule } from '@app/billing/limits.module';

@Module({
  imports: [LimitsModule],
  controllers: [ServicesController],
  providers: [ServicesService, ServiceRepository],
})
export class ServicesModule {}
