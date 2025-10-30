import { Module } from '@nestjs/common';
import { LimitsService } from './limit.service';

@Module({
  providers: [LimitsService],
  exports: [LimitsService],
})
export class LimitsModule {}
