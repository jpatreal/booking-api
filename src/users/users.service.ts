import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserRepository } from './user.repository';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UserRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private async cacheGet<T>(key: string): Promise<T | undefined> {
    return (await this.cache.get<T>(key)) ?? undefined;
  }
  private async cacheSet<T>(key: string, value: T, ttl = 30) {
    await this.cache.set(key, value, ttl);
  }
  private async cacheDel(key: string) {
    await this.cache.del(key);
  }

  async findById(id: string) {
    const key = `user:id:${id}`;
    const cached = await this.cacheGet<unknown>(key);
    if (cached) return cached;

    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('User not found');

    await this.cacheSet(key, user);
    await this.cacheSet(`user:email:${user.email}`, user);
    return user;
  }

  async findByEmail(email: string) {
    const norm = normalizeEmail(email);
    const key = `user:email:${norm}`;
    const cached = await this.cacheGet<unknown>(key);
    if (cached) return cached;

    const user = await this.repo.findByEmail(norm);
    if (!user) throw new NotFoundException('User not found');

    await this.cacheSet(key, user);
    await this.cacheSet(`user:id:${user.id}`, user);
    return user;
  }

  async create(params: { email: string; password?: string }) {
    const email = normalizeEmail(params.email);
    const data: any = {
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (params.password) {
      data.passwordHash = await argon2.hash(params.password);
    }

    try {
      const created = await this.repo.insert(data);
      await this.cacheSet(`user:id:${created.id}`, created);
      await this.cacheSet(`user:email:${created.email}`, created);
      return created;
    } catch (e: any) {
      if (e?.code === '23505') {
        if (
          e?.constraint?.toString().includes('email') ||
          `${e?.detail ?? ''}`.includes('email')
        ) {
          throw new ConflictException('Email already in use');
        }
      }
      throw e;
    }
  }

  async list(options: { q?: string; cursor?: string | null; take?: number }) {
    return this.repo.listKeyset({
      q: options.q ? normalizeEmail(options.q) : undefined,
      cursor: options.cursor ?? null,
      take: options.take,
    });
  }

  async update(id: string, params: { email?: string; password?: string }) {
    const data: any = { updatedAt: new Date() };
    if (params.email) data.email = normalizeEmail(params.email);
    if (params.password) data.passwordHash = await argon2.hash(params.password);

    if (Object.keys(data).length === 1) {
      throw new BadRequestException('No fields to update');
    }

    try {
      const updated = await this.repo.updateById(id, data);
      if (!updated) throw new NotFoundException('User not found');

      await this.cacheDel(`user:id:${id}`);
      if (updated.email) await this.cacheDel(`user:email:${updated.email}`);

      return updated;
    } catch (e: any) {
      if (e?.code === '23505') {
        if (
          e?.constraint?.toString().includes('email') ||
          `${e?.detail ?? ''}`.includes('email')
        ) {
          throw new ConflictException('Email already in use');
        }
      }
      throw e;
    }
  }
}
