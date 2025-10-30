import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { StaffRepository } from './staff.repository';
import { LimitsModule } from '@app/billing/limits.module';

@Module({
  imports: [LimitsModule],
  providers: [StaffService, StaffRepository],
  controllers: [StaffController],
})
export class StaffModule {}
