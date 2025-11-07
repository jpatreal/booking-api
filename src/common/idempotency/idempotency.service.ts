import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

const IN_PROGRESS = '__IN_PROGRESS__';

@Injectable()
export class IdempotencyService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async begin<T = any>(
    key: string,
    ttlSec = 24 * 60 * 60,
  ): Promise<{ done?: T; inProgress?: boolean }> {
    const existing = await this.cache.get<string | T>(key);
    if (existing === IN_PROGRESS) return { inProgress: true };
    if (existing != null) return { done: existing as T };

    await this.cache.set(key, IN_PROGRESS, ttlSec);
    return {};
  }

  async complete<T>(key: string, value: T, ttlSec = 24 * 60 * 60) {
    await this.cache.set(key, value, ttlSec);
  }

  async clear(key: string) {
    await this.cache.del(key as any);
  }
}
