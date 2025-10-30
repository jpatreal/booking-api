import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { ApiSuccess, PageResult } from './response.interface';
import {
  RES_BYPASS_KEY,
  RES_MSG_KEY,
  RES_PAGINATED_KEY,
} from './response.decorator';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const bypass = this.reflector.getAllAndOverride<boolean>(RES_BYPASS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (bypass) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const method = (req?.method || '').toUpperCase();
    const defaultMessage =
      method === 'GET'
        ? 'OK'
        : method === 'POST'
          ? 'Created'
          : method === 'PATCH' || method === 'PUT'
            ? 'Updated'
            : method === 'DELETE'
              ? 'Deleted'
              : 'OK';

    const message =
      this.reflector.getAllAndOverride<string>(RES_MSG_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) || defaultMessage;

    const forcePaginated =
      this.reflector.getAllAndOverride<boolean>(RES_PAGINATED_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) || false;

    return next.handle().pipe(
      map((body: any): ApiSuccess<any> => {
        if (body && typeof body === 'object' && 'success' in body)
          return body as ApiSuccess<any>;

        const looksPaginated =
          forcePaginated ||
          (body &&
            typeof body === 'object' &&
            'rows' in body &&
            'total' in body &&
            'page' in body &&
            'pageSize' in body);

        if (looksPaginated) {
          const { rows, total, page, pageSize, ...rest } =
            body as PageResult<any>;
          return {
            success: true,
            message,
            data: rows ?? [],
            meta: { total, page, pageSize, ...rest },
          };
        }

        return { success: true, message, data: body ?? null };
      }),
    );
  }
}
