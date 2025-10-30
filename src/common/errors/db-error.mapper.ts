import { HttpStatus } from '@nestjs/common';
import { AppError } from './app.error';
import { ErrorCode } from './error-codes';

type PrismaLikeError = { code?: string; meta?: any; message?: string };

type PgLikeError = {
  code?: string;
  constraint?: string;
  detail?: string;
  message?: string;
};

export function mapPrismaError(e: unknown): AppError | null {
  const err = e as PrismaLikeError;
  switch (err?.code) {
    case 'P2002':
      return new AppError('Unique constraint violated', {
        code: ErrorCode.DB_CONSTRAINT,
        status: HttpStatus.CONFLICT,
        details: { fields: err?.meta?.target },
        cause: e,
      });
    case 'P2003':
      return new AppError('Foreign key constraint failed', {
        code: ErrorCode.DB_CONSTRAINT,
        status: HttpStatus.BAD_REQUEST,
        details: { field: err?.meta?.field_name },
        cause: e,
      });
    case 'P2025':
      return new AppError('Resource not found', {
        code: ErrorCode.RESOURCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        cause: e,
      });
    default:
      return null;
  }
}

export function mapDrizzleOrPgError(e: unknown): AppError | null {
  const err = e as PgLikeError;

  switch (err?.code) {
    case '23505':
      return new AppError('Unique constraint violated', {
        code: ErrorCode.DB_CONSTRAINT,
        status: HttpStatus.CONFLICT,
        details: { constraint: err?.constraint, detail: err?.detail },
        cause: e,
      });
    case '23503':
      return new AppError('Foreign key constraint failed', {
        code: ErrorCode.DB_CONSTRAINT,
        status: HttpStatus.BAD_REQUEST,
        details: { constraint: err?.constraint, detail: err?.detail },
        cause: e,
      });
    case '23514':
      return new AppError('Check constraint failed', {
        code: ErrorCode.DB_CONSTRAINT,
        status: HttpStatus.BAD_REQUEST,
        details: { constraint: err?.constraint, detail: err?.detail },
        cause: e,
      });
    default:
      return null;
  }
}
