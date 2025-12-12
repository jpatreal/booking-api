import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { RedisKeys } from '@app/cache/redis-keys';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class GlobalRateLimitMiddleware implements NestMiddleware {
  constructor(private readonly rl: RateLimitService) {}

  private getClientIp(req: Request) {
    const xfwd = (req.headers['x-forwarded-for'] as string) || '';
    const firstHop = xfwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0];
    return firstHop || (req.ip ?? req.socket.remoteAddress ?? 'unknown');
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = String(this.getClientIp(req));

    const ok = await this.rl.hit(RedisKeys.rlGlobalIP(ip), 300, 60);
    if (!ok) {
      throw new HttpException(
        'Too many requests. Slow down.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
