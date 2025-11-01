import { Controller, Get, Inject } from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import { sql } from 'drizzle-orm';
import { REDIS_CLIENT } from '@app/redis/redis.module';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async get() {
    const now = new Date().toISOString();
    let db = 'down';

    try {
      await this.db.execute(sql`SELECT 1`);
      db = 'up';
    } catch (e) {}

    return {
      status: 'ok',
      now,
      db,
    } as const;
  }

  @Get('debug-sentry')
  getError() {
    throw new Error('My first Sentry error!');
  }

  @Get('redis')
  async ping() {
    const res = await this.redis.ping();
    return { redis: res === 'PONG' ? 'ok' : 'down' };
  }
}
