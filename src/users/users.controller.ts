import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { RedisKeys } from '@app/cache/redis-keys';
import { UnauthorizedAppError } from '@app/common/errors/specialized.errors';

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly rl: RateLimitService,
  ) {}

  private getClientIp(req: Request) {
    const xfwd = (req.headers['x-forwarded-for'] as string) || '';
    const first = xfwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0];
    return first || (req.ip ?? req.socket.remoteAddress ?? 'unknown');
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const ok = await this.rl.hit(RedisKeys.rlUserGetIP(ip), 240, 60);
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');

    return await this.users.findById(id);
  }

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('take') takeRaw?: string,
    @Req() req?: Request,
  ) {
    const ip = this.getClientIp(req!);
    const ok = await this.rl.hit(RedisKeys.rlUserListIP(ip), 180, 60);
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');

    const take = takeRaw ? parseInt(takeRaw, 10) : 25;
    return await this.users.list({ q, cursor: cursor ?? null, take });
  }

  @Post()
  async create(@Body() body: CreateUserDto, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const okGlobal = await this.rl.hit(RedisKeys.rlUserCreate(), 50, 60);
    const okIP = await this.rl.hit(RedisKeys.rlUserCreateIP(ip), 10, 60);
    if (!okGlobal || !okIP)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    const user = await this.users.create({
      email: body.email,
      password: body.password,
    });
    return user;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Req() req: Request,
  ) {
    const ip = this.getClientIp(req);
    const ok1 = await this.rl.hit(RedisKeys.rlUserUpdate(id), 60, 60);
    const ok2 = await this.rl.hit(RedisKeys.rlUserUpdateIP(id, ip), 30, 60);
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    const user = await this.users.update(id, {
      email: body.email,
      password: body.password,
    });
    return user;
  }
}
