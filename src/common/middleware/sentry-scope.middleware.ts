import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class SentryScopeMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const traceId = (req as any).traceId || req.headers['x-request-id'];

    if (traceId) Sentry.setTag('traceId', String(traceId));
    Sentry.setTag('route', `${req.method} ${req.url}`);
    Sentry.setContext('request', {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
    });

    const user = (req as any).user as
      | { sub?: string; email?: string }
      | undefined;
    if (user?.sub || user?.email)
      Sentry.setUser({ id: user.sub, email: user.email } as any);

    next();
  }
}
