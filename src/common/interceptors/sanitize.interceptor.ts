import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

export const SKIP_SANITIZE_KEY = 'skipSanitize';

export function SkipSanitize() {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(
      SKIP_SANITIZE_KEY,
      true,
      descriptor?.value ?? target,
    );
  };
}

function isPlainObject(value: any): value is Record<string, any> {
  if (value === null || typeof value !== 'object') return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

type JsonLike = Record<string, any> | any[] | null;

function stripKeysDeep<T extends JsonLike>(value: T, deny: string[]): T {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((v) => stripKeysDeep(v as JsonLike, deny)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (deny.includes(k)) continue;
    out[k] = stripKeysDeep(v as JsonLike, deny);
  }
  return out as T;
}

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly denylist: string[] = [],
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = ctx.getHandler();
    const skip = this.reflector.get<boolean>(SKIP_SANITIZE_KEY, handler);
    if (skip) return next.handle();

    return next
      .handle()
      .pipe(map((data) => stripKeysDeep(data, this.denylist)));
  }
}
