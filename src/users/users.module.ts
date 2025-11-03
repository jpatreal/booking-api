import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { CacheModule } from '@nestjs/cache-manager';
import { UsersController } from './users.controller';
import { UserRepository } from './user.repository';
import { UsersCache } from './users.cache';
import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';

@Module({
  imports: [CacheModule.register({ ttl: 30 })],
  providers: [UsersService, UserRepository, UsersCache, RateLimitService],
  controllers: [UsersController],
})
export class UsersModule {}
