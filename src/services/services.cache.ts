import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { RedisKeys } from '@app/cache/redis-keys';
import { ServiceRepository } from './service.repository';

function normQ(q?: string) {
  return q?.trim() || undefined;
}

function listHash(
  bizId: string,
  q: string | undefined,
  page?: number,
  pageSize?: number,
) {
  const h = createHash('sha1')
    .update(`${bizId}|${q ?? ''}|${page ?? 1}|${pageSize ?? 20}`)
    .digest('hex')
    .slice(0, 16);
  return h;
}

@Injectable()
export class ServicesCache {
  constructor(
    private readonly repo: ServiceRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private getRedis() {
    const store: any = (this.cache as any)?.store;
    return store?.getClient?.() ?? store?.client;
  }

  private async set<T>(key: string, value: T, ttlSec: number) {
    await this.cache.set(key, value as any, ttlSec);
  }
  private async get<T>(key: string): Promise<T | undefined> {
    return (await this.cache.get<T>(key)) ?? undefined;
  }
  private async del(key: string) {
    await this.cache.del(key);
  }

  private async withLock(
    lockKey: string,
    run: () => Promise<any>,
    lockTtl = 2,
  ) {
    const redis = this.getRedis();
    if (!redis) return run();
    const ok = await redis.set(lockKey, '1', 'EX', lockTtl, 'NX');
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

  private async getListVersion(bizId: string): Promise<number> {
    const redis = this.getRedis();
    const verKey = RedisKeys.svcListVer(bizId);
    if (redis) {
      const v = await redis.get(verKey);
      if (v) return Number(v) || 1;
      await redis.set(verKey, '1');
      return 1;
    }

    const v = await this.get<number>(verKey);
    if (v) return v;
    await this.set(verKey, 1, 3600);
    return 1;
  }

  async bumpListVersion(bizId: string) {
    const redis = this.getRedis();
    const verKey = RedisKeys.svcListVer(bizId);
    if (redis) {
      await redis.incr(verKey);
    } else {
      const current = (await this.get<number>(verKey)) ?? 1;
      await this.set(verKey, current + 1, 3600);
    }
  }

  async getById(businessId: string, id: string) {
    const key = RedisKeys.svcById(businessId, id);
    const neg = RedisKeys.svcIdNeg(businessId, id);

    const negHit = await this.get(neg);
    if (negHit) return null;

    const cached = await this.get<any>(key);
    if (cached) return cached;

    const lockKey = RedisKeys.svcLockId(businessId, id);
    return this.withLock(lockKey, async () => {
      const again = await this.get<any>(key);
      if (again) return again;

      const row = await this.repo
        .findByIdOrThrow(businessId, id)
        .catch(() => null);
      if (!row) {
        await this.set(neg, 1, 60);
        return null;
      }
      await this.set(key, row, 300);
      return row;
    });
  }

  async getList(
    businessId: string,
    params: { q?: string; page?: number; pageSize?: number },
    fetcher: () => Promise<{
      rows: any[];
      total: number;
      page: number;
      pageSize: number;
    }>,
    ttlSec = 15,
  ) {
    const q = normQ(params.q);
    const ver = await this.getListVersion(businessId);
    const k = RedisKeys.svcListKey(
      businessId,
      ver,
      q,
      params.page,
      params.pageSize,
    );
    const lockKey = RedisKeys.svcLockList(
      businessId,
      listHash(businessId, q, params.page, params.pageSize),
    );

    const cached = await this.get<any>(k);
    if (cached) return cached;

    return this.withLock(lockKey, async () => {
      const again = await this.get<any>(k);
      if (again) return again;

      const result = await fetcher();
      await this.set(k, result, ttlSec);
      return result;
    });
  }

  async invalidateById(businessId: string, id: string) {
    await this.del(RedisKeys.svcById(businessId, id));
    await this.del(RedisKeys.svcIdNeg(businessId, id));
  }

  async touchLists(businessId: string) {
    await this.bumpListVersion(businessId);
  }
}
