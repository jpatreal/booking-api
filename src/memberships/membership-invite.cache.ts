import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InviteKeys as K } from '@app/cache/redis-keys';

@Injectable()
export class MembershipInvitesCache {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private getRedis() {
    const store: any = (this.cache as any)?.store;
    return store?.getClient?.() ?? store?.client;
  }
  private async get<T>(k: string) {
    return (await this.cache.get<T>(k)) ?? undefined;
  }
  private async set<T>(k: string, v: T, ttl: number) {
    await this.cache.set(k, v as any, ttl);
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
    const redis = this.getRedis();
    const k = K.invListVer(bizId);
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
    const k = K.invListVer(bizId);
    if (redis) await redis.incr(k);
    else {
      const cur = (await this.get<number>(k)) ?? 1;
      await this.set(k, cur + 1, 3600);
    }
  }

  async getPendingList(
    bizId: string,
    fetcher: () => Promise<any>,
    ttlSec = 15,
  ) {
    const ver = await this.getListVer(bizId);
    const key = K.invListKey(bizId, ver);
    const cached = await this.get<any>(key);
    if (cached) return cached;
    return this.withLock(K.invLockList(bizId), async () => {
      const again = await this.get<any>(key);
      if (again) return again;
      const data = await fetcher();
      await this.set(key, data, ttlSec);
      return data;
    });
  }

  async getByTokenHash(hash: string, fetcher: () => Promise<any>) {
    const key = K.invByTok(hash);
    const neg = K.invTokNeg(hash);
    const cached = await this.get<any>(key);
    if (cached) return cached;
    if (await this.get(neg)) return null;

    return this.withLock(K.invLockTok(hash), async () => {
      const again = await this.get<any>(key);
      if (again) return again;
      const row = await fetcher();
      if (!row) {
        await this.set(neg, 1, 60);
        return null;
      }
      await this.set(key, row, 300);
      return row;
    });
  }

  async invalidateToken(hash: string) {
    await this.del(K.invByTok(hash));
    await this.del(K.invTokNeg(hash));
  }
}
