import { Module } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { BusinessesRepository } from './businesses.repository';
import { BusinessesController } from './businesses.controller';

@Module({
  providers: [BusinessesService, BusinessesRepository],
  exports: [BusinessesService, BusinessesRepository],
  controllers: [BusinessesController],
})
export class BusinessesModule {}
