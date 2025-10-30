import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { CacheModule } from '@nestjs/cache-manager';
import { UsersController } from './users.controller';
import { UserRepository } from './user.repository';

@Module({
  imports: [CacheModule.register({ ttl: 30 })],
  providers: [UsersService, UserRepository],
  controllers: [UsersController],
})
export class UsersModule {}
