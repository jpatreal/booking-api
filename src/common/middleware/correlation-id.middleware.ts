import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export const CORRELATION_ID_HEADER = 'x-request-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const existing = req.header(CORRELATION_ID_HEADER);
    const id = existing || randomUUID();
    (req as any).correlationId = id;
    res.setHeader(CORRELATION_ID_HEADER, id);
    next();
  }
}
