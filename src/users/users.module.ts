import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { CacheModule } from '@nestjs/cache-manager';
import { UsersController } from './users.controller';
import { UserRepository } from './user.repository';
import { UsersCache } from './users.cache';

@Module({
  imports: [CacheModule.register({ ttl: 30 })],
  providers: [UsersService, UserRepository, UsersCache],
  controllers: [UsersController],
})
export class UsersModule {}
