import { Module } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { BusinessesRepository } from './businesses.repository';
import { BusinessesController } from './businesses.controller';
import { BusinessesCache } from './business.cache';

@Module({
  providers: [BusinessesService, BusinessesRepository, BusinessesCache],
  exports: [BusinessesService, BusinessesRepository],
  controllers: [BusinessesController],
})
export class BusinessesModule {}
