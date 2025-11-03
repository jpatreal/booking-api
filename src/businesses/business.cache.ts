import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { RedisKeys } from '@app/cache/redis-keys';
import { BusinessesRepository } from './businesses.repository';

function hashListKey(
  userId: string,
  q?: string,
  page?: number,
  pageSize?: number,
  includeDeleted?: boolean,
) {
  return createHash('sha1')
    .update(
      `${userId}|${q ?? ''}|${page ?? 1}|${pageSize ?? 20}|${!!includeDeleted}`,
    )
    .digest('hex')
    .slice(0, 16);
}

@Injectable()
export class BusinessesCache {
  constructor(
    private readonly repo: BusinessesRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private getRedis() {
    const store: any = (this.cache as any)?.store;
    return store?.getClient?.() ?? store?.client;
  }
  private async set<T>(key: string, val: T, ttl: number) {
    await this.cache.set(key, val as any, ttl);
  }
  private async get<T>(key: string): Promise<T | undefined> {
    return (await this.cache.get<T>(key)) ?? undefined;
  }
  private async del(key: string) {
    await this.cache.del(key);
  }

  private async withLock(lockKey: string, run: () => Promise<any>, ttl = 2) {
    const redis = this.getRedis();
    if (!redis) return run();
    const ok = await redis.set(lockKey, '1', 'EX', ttl, 'NX');
    if (ok === 'OK') {
      try {
        return await run();
      } finally {
        await redis.del(lockKey);
      }
    }
    await new Promise((r) => setTimeout(r, 40));
    return run();
  }

  async getById(id: string) {
    const key = RedisKeys.bizById(id);
    const neg = RedisKeys.bizNegId(id);
    const cached = await this.get<any>(key);
    if (cached) return cached;
    if (await this.get(neg)) return null;

    const lock = RedisKeys.bizLockId(id);
    return this.withLock(lock, async () => {
      const again = await this.get<any>(key);
      if (again) return again;

      const row = await this.repo.findWithHours(id).catch(() => null);
      if (!row) {
        await this.set(neg, 1, 60);
        return null;
      }
      await this.set(key, row, 300);
      return row;
    });
  }

  async getBySlug(slug: string) {
    const key = RedisKeys.bizBySlug(slug);
    const neg = RedisKeys.bizNegSlug(slug);
    const cached = await this.get<any>(key);
    if (cached) return cached;
    if (await this.get(neg)) return null;

    const lock = RedisKeys.bizLockSlug(slug);
    return this.withLock(lock, async () => {
      const again = await this.get<any>(key);
      if (again) return again;

      const row = await this.repo.findWithHours(slug).catch(() => null);
      if (!row) {
        await this.set(neg, 1, 60);
        return null;
      }
      await this.set(key, row, 300);
      return row;
    });
  }

  async getHours(businessId: string) {
    const key = RedisKeys.bizHours(businessId);
    const cached = await this.get<any>(key);
    if (cached) return cached;
    const hrs = await this.repo.listHours(businessId);
    await this.set(key, hrs, 60);
    return hrs;
  }

  async invalidateEntity(id: string, slug?: string) {
    await this.del(RedisKeys.bizById(id));
    await this.del(RedisKeys.bizNegId(id));
    await this.del(RedisKeys.bizHours(id));
    if (slug) {
      await this.del(RedisKeys.bizBySlug(slug));
      await this.del(RedisKeys.bizNegSlug(slug));
    }
  }

  private async getListVersion(userId: string): Promise<number> {
    const redis = this.getRedis();
    const k = RedisKeys.bizListVer(userId);
    if (redis) {
      const v = await redis.get(k);
      if (v) return Number(v) || 1;
      await redis.set(k, '1');
      return 1;
    } else {
      const v = await this.get<number>(k);
      if (v) return v;
      await this.set(k, 1, 3600);
      return 1;
    }
  }

  async bumpListVersion(userId: string) {
    const redis = this.getRedis();
    const k = RedisKeys.bizListVer(userId);
    if (redis) await redis.incr(k);
    else {
      const cur = (await this.get<number>(k)) ?? 1;
      await this.set(k, cur + 1, 3600);
    }
  }

  async getList(
    userId: string,
    params: {
      q?: string;
      page?: number;
      pageSize?: number;
      includeDeleted?: boolean;
    },
    fetcher: () => Promise<any>,
    ttlSec = 15,
  ) {
    const ver = await this.getListVersion(userId);
    const cacheKey = RedisKeys.bizListKey(
      userId,
      ver,
      params.q,
      params.page,
      params.pageSize,
      params.includeDeleted,
    );
    const cached = await this.get<any>(cacheKey);
    if (cached) return cached;

    const lock = RedisKeys.bizLockList(
      hashListKey(
        userId,
        params.q,
        params.page,
        params.pageSize,
        params.includeDeleted,
      ),
    );
    return this.withLock(lock, async () => {
      const again = await this.get<any>(cacheKey);
      if (again) return again;
      const result = await fetcher();
      await this.set(cacheKey, result, ttlSec);
      return result;
    });
  }
}
