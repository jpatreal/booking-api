import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { LimitsService } from '@app/billing/limit.service';

@Module({
  providers: [AdminService, LimitsService],
  controllers: [AdminController],
})
export class AdminModule {}
