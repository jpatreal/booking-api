import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { TimeoutError, timeout, catchError } from 'rxjs';

const DEFAULT_TIMEOUT_MS = 8000;

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      timeout(DEFAULT_TIMEOUT_MS),
      catchError((err) => {
        if (err instanceof TimeoutError)
          throw new RequestTimeoutException('Request timed out');
        throw err;
      }),
    );
  }
}
