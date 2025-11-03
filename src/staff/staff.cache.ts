import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { RedisKeys } from '@app/cache/redis-keys';
import { StaffRepository } from './staff.repository';

function sig(
  bizId: string,
  q?: string,
  page?: number,
  pageSize?: number,
  activeOnly?: boolean,
) {
  return createHash('sha1')
    .update(
      `${bizId}|${q ?? ''}|${page ?? 1}|${pageSize ?? 20}|${!!activeOnly}`,
    )
    .digest('hex')
    .slice(0, 16);
}

@Injectable()
export class StaffCache {
  constructor(
    private readonly repo: StaffRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private getRedis() {
    const store: any = (this.cache as any)?.store;
    return store?.getClient?.() ?? store?.client;
  }
  private async set<T>(k: string, v: T, ttl: number) {
    await this.cache.set(k, v as any, ttl);
  }
  private async get<T>(k: string): Promise<T | undefined> {
    return (await this.cache.get<T>(k)) ?? undefined;
  }
  private async del(k: string) {
    await this.cache.del(k);
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

  private async getListVer(bizId: string) {
    const redis = this.getRedis(),
      k = RedisKeys.staffListVer(bizId);
    if (redis) {
      const v = await redis.get(k);
      if (v) return Number(v) || 1;
      await redis.set(k, '1');
      return 1;
    }
    const v = await this.get<number>(k);
    if (v) return v;
    await this.set(k, 1, 3600);
    return 1;
  }
  async bumpListVer(bizId: string) {
    const redis = this.getRedis(),
      k = RedisKeys.staffListVer(bizId);
    if (redis) await redis.incr(k);
    else {
      const cur = (await this.get<number>(k)) ?? 1;
      await this.set(k, cur + 1, 3600);
    }
  }
  private async getVer(k: string) {
    const redis = this.getRedis();
    if (redis) {
      const v = await redis.get(k);
      if (v) return Number(v) || 1;
      await redis.set(k, '1');
      return 1;
    }
    const v = await this.get<number>(k);
    if (v) return v;
    await this.set(k, 1, 3600);
    return 1;
  }
  private async bumpVer(k: string) {
    const redis = this.getRedis();
    if (redis) await redis.incr(k);
    else {
      const cur = (await this.get<number>(k)) ?? 1;
      await this.set(k, cur + 1, 3600);
    }
  }

  async getById(bizId: string, staffId: string) {
    const key = RedisKeys.staffById(bizId, staffId);
    const neg = RedisKeys.staffNegId(bizId, staffId);
    const cached = await this.get<any>(key);
    if (cached) return cached;
    if (await this.get(neg)) return null;

    const lock = RedisKeys.staffLockId(bizId, staffId);
    return this.withLock(lock, async () => {
      const again = await this.get<any>(key);
      if (again) return again;
      const row = await this.repo
        .findById(staffId, { businessId: bizId })
        .catch(() => null);
      if (!row) {
        await this.set(neg, 1, 60);
        return null;
      }
      await this.set(key, row, 300);
      return row;
    });
  }

  async invalidateById(bizId: string, staffId: string) {
    await this.del(RedisKeys.staffById(bizId, staffId));
    await this.del(RedisKeys.staffNegId(bizId, staffId));
  }

  async getList(
    bizId: string,
    params: {
      q?: string;
      page?: number;
      pageSize?: number;
      activeOnly?: boolean;
    },
    fetcher: () => Promise<any>,
    ttlSec = 15,
  ) {
    const ver = await this.getListVer(bizId);
    const k = RedisKeys.staffListKey(
      bizId,
      ver,
      params.q,
      params.page,
      params.pageSize,
      params.activeOnly,
    );
    const cached = await this.get<any>(k);
    if (cached) return cached;
    const lock = RedisKeys.staffLockList(
      bizId,
      sig(bizId, params.q, params.page, params.pageSize, params.activeOnly),
    );
    return this.withLock(lock, async () => {
      const again = await this.get<any>(k);
      if (again) return again;
      const data = await fetcher();
      await this.set(k, data, ttlSec);
      return data;
    });
  }

  async listServices(staffId: string, fetcher: () => Promise<any>) {
    const v = await this.getVer(RedisKeys.staffSvcVer(staffId));
    const k = RedisKeys.staffSvcKey(staffId, v);
    const cached = await this.get<any>(k);
    if (cached) return cached;
    return this.withLock(RedisKeys.staffLockSvc(staffId), async () => {
      const again = await this.get<any>(k);
      if (again) return again;
      const data = await fetcher();
      await this.set(k, data, 60);
      return data;
    });
  }
  async touchServices(staffId: string) {
    await this.bumpVer(RedisKeys.staffSvcVer(staffId));
  }

  async listAvailability(staffId: string, fetcher: () => Promise<any>) {
    const v = await this.getVer(RedisKeys.staffAvailVer(staffId));
    const k = RedisKeys.staffAvailKey(staffId, v);
    const cached = await this.get<any>(k);
    if (cached) return cached;
    return this.withLock(RedisKeys.staffLockAvail(staffId), async () => {
      const again = await this.get<any>(k);
      if (again) return again;
      const data = await fetcher();
      await this.set(k, data, 60);
      return data;
    });
  }
  async touchAvailability(staffId: string) {
    await this.bumpVer(RedisKeys.staffAvailVer(staffId));
  }

  async listTimeOff(staffId: string, fetcher: () => Promise<any>) {
    const v = await this.getVer(RedisKeys.staffToVer(staffId));
    const k = RedisKeys.staffToKey(staffId, v);
    const cached = await this.get<any>(k);
    if (cached) return cached;
    return this.withLock(RedisKeys.staffLockTo(staffId), async () => {
      const again = await this.get<any>(k);
      if (again) return again;
      const data = await fetcher();
      await this.set(k, data, 30);
      return data;
    });
  }
  async touchTimeOff(staffId: string) {
    await this.bumpVer(RedisKeys.staffToVer(staffId));
  }
}
