import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class RateLimitService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  private getRedisClient(): any | undefined {
    const store: any = (this.cache as any)?.store;
    return store?.getClient?.() ?? store?.client;
  }

  async hit(key: string, limit: number, windowSec: number): Promise<boolean> {
    const redis = this.getRedisClient();
    if (redis) {
      const res = await redis.multi().incr(key).expire(key, windowSec).exec();

      const count = Number(res?.[0]?.[1] ?? 0);
      return count <= limit;
    }

    const current = Number((await this.cache.get<number>(key)) ?? 0);
    if (current === 0) {
      await this.cache.set(key, 1, windowSec);
      return true;
    }
    const next = current + 1;
    await this.cache.set(key, next, windowSec);
    return next <= limit;
  }
}
