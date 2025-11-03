import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { MembershipKeys as K } from '@app/cache/redis-keys';
import { MembershipsRepository } from './memberships.repository';

function sig(obj: Record<string, any>) {
  return createHash('sha1')
    .update(JSON.stringify(obj, Object.keys(obj).sort()))
    .digest('hex')
    .slice(0, 16);
}

@Injectable()
export class MembershipsCache {
  constructor(
    private readonly repo: MembershipsRepository,
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

  async getById(id: string) {
    const key = K.memById(id);
    const neg = K.memNegId(id);
    const cached = await this.get<any>(key);
    if (cached) return cached;
    if (await this.get(neg)) return null;

    return this.withLock(K.memLockId(id), async () => {
      const again = await this.get<any>(key);
      if (again) return again;

      const row = await this.repo.findById(id).catch(() => null);
      if (!row) {
        await this.set(neg, 1, 60);
        return null;
      }
      await this.set(key, row, 300);
      return row;
    });
  }

  async invalidateById(id: string) {
    await this.del(K.memById(id));
    await this.del(K.memNegId(id));
  }

  private async getListVer(bizId: string): Promise<number> {
    const redis = this.getRedis();
    const k = K.memListVer(bizId);
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
    const redis = this.getRedis();
    const k = K.memListVer(bizId);
    if (redis) await redis.incr(k);
    else {
      const cur = (await this.get<number>(k)) ?? 1;
      await this.set(k, cur + 1, 3600);
    }
  }

  async getList(
    bizId: string,
    params: Record<string, any>,
    fetcher: () => Promise<any>,
    ttlSec = 15,
  ) {
    const ver = await this.getListVer(bizId);
    const s = sig(params);
    const key = K.memListKey(bizId, ver, s);
    const cached = await this.get<any>(key);
    if (cached) return cached;

    return this.withLock(K.memLockList(bizId, s), async () => {
      const again = await this.get<any>(key);
      if (again) return again;
      const result = await fetcher();
      await this.set(key, result, ttlSec);
      return result;
    });
  }

  async getOwnersCount(bizId: string, fetcher: () => Promise<number>) {
    const key = K.ownersCount(bizId);
    const c = await this.get<number>(key);
    if (typeof c === 'number') return c;
    const count = await fetcher();
    await this.set(key, count, 30);
    return count;
  }
  async touchOwners(bizId: string) {
    await this.del(K.ownersCount(bizId));
  }
}
