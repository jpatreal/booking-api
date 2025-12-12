import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import IORedis, { Redis } from 'ioredis';
import redisConfig from '@app/config/redis.config';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  imports: [ConfigModule.forFeature(redisConfig)],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const url = config.get<string>('redis.url') ?? process.env.REDIS_URL;

        if (!url) {
          throw new Error(
            'REDIS_URL is required (missing redis.url / REDIS_URL)',
          );
        }

        const isTls = url.startsWith('rediss://');
        const host = isTls ? new URL(url).hostname : undefined;

        const client = new IORedis(url, {
          family: 4,

          ...(isTls ? { tls: { servername: host } } : {}),

          connectTimeout: 10_000,
          enableReadyCheck: true,
          lazyConnect: false,

          maxRetriesPerRequest: 3,
        });

        client.on('error', (e) =>
          console.error('[Redis] error', e?.message ?? e),
        );
        client.on('connect', () => console.log('[Redis] connected'));

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
