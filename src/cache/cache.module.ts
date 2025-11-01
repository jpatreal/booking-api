import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import redisConfig from '../config/redis.config';

@Module({
  imports: [
    ConfigModule.forFeature(redisConfig),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule.forFeature(redisConfig)],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const url = config.get<string>('redis.url');
        return {
          store: await redisStore({
            url,
            ttl: 30,
            pingInterval: 0,
          }),
          // isGlobal: true,
        };
      },
    }),
  ],
})
export class AppCacheModule {}
