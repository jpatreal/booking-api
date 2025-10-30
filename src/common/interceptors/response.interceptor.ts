import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs/operators';

interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, any>;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Envelope<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>) {
    return next.handle().pipe(
      map((res: any) => {
        if (res && typeof res === 'object' && 'data' in res) {
          const { data, meta } = res;
          return { success: true, data, ...(meta ? { meta } : {}) };
        }
        return { success: true, data: res };
      }),
    );
  }
}
