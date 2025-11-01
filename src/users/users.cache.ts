import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { RedisKeys } from '@app/cache/redis-keys';
import { UserRepository } from './user.repository';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type UserSafe = {
  id: string;
  email: string;
  [k: string]: any;
};

@Injectable()
export class UsersCache {
  constructor(
    private readonly repo: UserRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private client() {
    return (this.cache as any).store?.client;
  }

  private async set<T>(key: string, value: T, ttlSec: number) {
    await this.cache.set(key, value, ttlSec);
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
    const client = this.client();
    if (!client) return run();
    const ok = await client.set(lockKey, '1', 'EX', lockTtl, 'NX');
    if (ok === 'OK') {
      try {
        return await run();
      } finally {
        await client.del(lockKey);
      }
    }

    await new Promise((r) => setTimeout(r, 50));
    return run();
  }

  async getById(id: string): Promise<UserSafe | null> {
    const k = RedisKeys.userById(id);
    const neg = RedisKeys.userIdNeg(id);

    const negHit = await this.get(neg);
    if (negHit) return null;

    const cached = await this.get<UserSafe>(k);
    if (cached) return cached;

    const lockKey = RedisKeys.userLockById(id);
    return this.withLock(lockKey, async () => {
      const again = await this.get<UserSafe>(k);
      if (again) return again;

      const user = await this.repo.findById(id);
      if (!user) {
        await this.set(neg, 1, 60);
        return null;
      }

      await this.set(k, user, 300);
      await this.set(RedisKeys.userByEmail(user.email), user, 300);
      return user;
    });
  }

  async getByEmail(emailRaw: string): Promise<UserSafe | null> {
    const email = normalizeEmail(emailRaw);
    const k = RedisKeys.userByEmail(email);
    const neg = RedisKeys.userEmailNeg(email);

    const negHit = await this.get(neg);
    if (negHit) return null;

    const cached = await this.get<UserSafe>(k);
    if (cached) return cached;

    const lockKey = RedisKeys.userLockByEmail(email);
    return this.withLock(lockKey, async () => {
      const again = await this.get<UserSafe>(k);
      if (again) return again;

      const user = await this.repo.findByEmail(email);
      if (!user) {
        await this.set(neg, 1, 60);
        return null;
      }
      await this.set(k, user, 300);
      await this.set(RedisKeys.userById(user.id), user, 300);
      return user;
    });
  }

  async prime(user: UserSafe) {
    await this.set(RedisKeys.userById(user.id), user, 300);
    await this.set(RedisKeys.userByEmail(user.email), user, 300);
  }

  async invalidateById(id: string) {
    const current = await this.getById(id);
    await this.del(RedisKeys.userById(id));
    if (current?.email) await this.del(RedisKeys.userByEmail(current.email));
  }

  async invalidateByEmail(emailRaw: string) {
    const email = normalizeEmail(emailRaw);
    const current = await this.getByEmail(email);
    await this.del(RedisKeys.userByEmail(email));
    if (current?.id) await this.del(RedisKeys.userById(current.id));
  }

  async swapEmailKeys(oldEmail: string | undefined, user: UserSafe) {
    if (oldEmail && oldEmail !== user.email) {
      await this.del(RedisKeys.userByEmail(oldEmail));
    }
    await this.del(RedisKeys.userById(user.id));
    await this.del(RedisKeys.userByEmail(user.email));
    await this.prime(user);
  }
}
