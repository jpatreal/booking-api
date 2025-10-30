import { Controller, Get, Inject } from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import { sql } from 'drizzle-orm';

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

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
}
