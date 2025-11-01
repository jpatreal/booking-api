import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserRepository } from './user.repository';
import { UsersCache } from './users.cache';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UserRepository,
    private readonly usersCache: UsersCache,
  ) {}

  async findById(id: string) {
    const user = await this.usersCache.getById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string) {
    const user = await this.usersCache.getByEmail(email);
    if (!user) throw new NotFoundException('User not found');
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
      await this.usersCache.prime(created);
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
      const current = await this.repo.findById(id);
      if (!current) throw new NotFoundException('User not found');

      const updated = await this.repo.updateById(id, data);
      if (!updated) throw new NotFoundException('User not found');

      await this.usersCache.swapEmailKeys(current.email, updated);
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
