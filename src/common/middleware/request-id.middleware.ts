import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let traceId = req.headers['x-request-id'] as string | undefined;
    if (!traceId) traceId = randomBytes(12).toString('hex');
    (req as any).traceId = traceId;
    res.setHeader('x-request-id', traceId);
    next();
  }
}
