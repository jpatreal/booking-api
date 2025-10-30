import { Module } from '@nestjs/common';
import { SignupKeysController } from './admin.controller';

@Module({
  controllers: [SignupKeysController],
})
export class AdminModule {}
