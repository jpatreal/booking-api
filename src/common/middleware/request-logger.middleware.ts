import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLogger implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const start = Date.now();
    _res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(
        `${req.method} ${req.originalUrl} → ${_res.statusCode} (${ms}ms)`,
      );
    });
    next();
  }
}
