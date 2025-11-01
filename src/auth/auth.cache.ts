import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { RedisKeys } from '../cache/redis-keys';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import { users } from '@app/db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class AuthCache {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    @Inject(DRIZZLE) private db: DB,
  ) {}

  async getUserEmailById(userId: string): Promise<string | null> {
    const key = RedisKeys.userEmailById(userId);
    const cached = await this.cache.get<string>(key);
    if (cached) return cached;

    const row = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const email = row?.[0]?.email ?? null;
    if (email) await this.cache.set(key, email, 300);
    return email;
  }

  async invalidateUserEmail(userId: string) {
    await this.cache.del(RedisKeys.userEmailById(userId));
  }
}
