import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  LoginDto,
  RegisterDto,
  RequestResetDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { Request, Response } from 'express';
import { setRefreshCookie } from '@app/common/utils/cookies.util';
import { JwtAccessPayload } from '@app/common/interfaces';
import { JwtAccessGuard } from './guards/jwt-access.guards';

import { UnauthorizedAppError } from '@app/common/errors/specialized.errors';
import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { RedisKeys } from '@app/cache/redis-keys';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rl: RateLimitService,
  ) {}

  private getClientIp(req: Request) {
    const xfwd = (req.headers['x-forwarded-for'] as string) || '';
    const firstHop = xfwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0];
    return firstHop || (req.ip ?? req.socket.remoteAddress ?? 'unknown');
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ip = String(this.getClientIp(req));
    const ok = await this.rl.hit(RedisKeys.rlRegisterIP(ip), 10, 60);
    if (!ok) {
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');
    }

    const { user, biz } = await this.auth.register(dto);
    return { user: { id: user.id, email: user.email }, business: biz };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.validateLocalUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedAppError('Invalid credentials', {
        hint: 'Check email and password',
      });
    }

    const pair = await this.auth.issueAuthPair(user.id, undefined, req);
    setRefreshCookie(res, pair.refresh, {
      domain: this.config.get('COOKIE_DOMAIN')!,
      secure: this.config.get('COOKIE_SECURE') === 'true',
    });
    return { accessToken: pair.accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.['refresh_token'];
    if (!raw) {
      throw new UnauthorizedAppError('No refresh token', {
        cookie: 'refresh_token',
      });
    }

    const header = req.headers['authorization'];
    let userId: string | undefined;
    if (header?.startsWith('Bearer ')) {
      const decoded: any = this.jwt.decode(header.slice(7));
      userId = decoded?.sub;
    }

    if (!userId) {
      throw new UnauthorizedAppError('No user context', {
        hint: 'Send current (even expired) access token in Authorization header to carry `sub`.',
      });
    }

    const pair = await this.auth.refreshByCookie(raw, userId, req);
    setRefreshCookie(res, pair.refresh, {
      domain: this.config.get('COOKIE_DOMAIN')!,
      secure: this.config.get('COOKIE_SECURE') === 'true',
    });
    return { accessToken: pair.accessToken };
  }

  @Post('request-reset')
  async requestReset(@Body() dto: RequestResetDto) {
    await this.auth.sendPasswordReset(dto.email);
    return { ok: true };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
    return { ok: true };
  }

  @UseGuards(JwtAccessGuard)
  @Get('me')
  me(@Req() req: Request & { user: JwtAccessPayload }) {
    return req.user;
  }
}
