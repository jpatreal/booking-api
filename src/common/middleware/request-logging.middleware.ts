import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const traceId = (req as any).traceId;

    console.log(
      `[REQ] ${req.method} ${req.originalUrl} traceId=${traceId} ip=${req.ip}`,
    );

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - now;
        console.log(
          `[RES] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms traceId=${traceId}`,
        );
      }),
    );
  }
}
