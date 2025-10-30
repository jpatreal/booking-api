import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../errors/app.error';
import { ErrorCode } from '../errors/error-codes';
import { mapDrizzleOrPgError, mapPrismaError } from '../errors/db-error.mapper';
import { SentryExceptionCaptured } from '@sentry/nestjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly exposeStack = process.env.NODE_ENV !== 'production',
  ) {}

  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const traceId =
      (req as any).traceId || req.headers['x-request-id'] || undefined;

    let normalized = this.normalize(exception);

    const basePayload: any = {
      statusCode: normalized.status,
      code: normalized.code,
      message: normalized.message,
      traceId,
      path: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
    };

    if (normalized.details) basePayload.details = normalized.details;
    if (this.exposeStack && (exception as any)?.stack) {
      basePayload.stack = (exception as any).stack;
      basePayload.cause = (exception as any).cause ?? normalized.cause;
    }

    console.error('[ERROR]', JSON.stringify({ ...basePayload }, null, 2));

    res.status(normalized.status).json(basePayload);
  }

  private normalize(exception: unknown): AppError {
    if (exception instanceof AppError) return exception;

    if (exception instanceof HttpException) {
      const status =
        exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
      const response = exception.getResponse?.() as any;
      const message =
        response?.message || exception.message || 'Request failed';
      const details =
        typeof response === 'object' ? { ...response } : undefined;
      return new AppError(message, {
        status,
        code: this.codeFromStatus(status),
        details,
        cause: exception,
      });
    }

    const prismaMapped = mapPrismaError(exception);
    if (prismaMapped) return prismaMapped;

    const drizzleMapped = mapDrizzleOrPgError(exception);
    if (drizzleMapped) return drizzleMapped;

    const message = (exception as any)?.message ?? 'Internal Server Error';
    return new AppError(message, {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      cause: exception,
    });
  }

  private codeFromStatus(status: number): ErrorCode {
    if (status >= 500) return ErrorCode.INTERNAL_ERROR;
    if (status === 404) return ErrorCode.RESOURCE_NOT_FOUND;
    if (status === 409) return ErrorCode.CONFLICT;
    if (status === 401) return ErrorCode.AUTH_UNAUTHORIZED;
    if (status === 403) return ErrorCode.AUTH_FORBIDDEN;
    if (status === 400) return ErrorCode.VALIDATION_FAILED;
    return ErrorCode.INTERNAL_ERROR;
  }
}
