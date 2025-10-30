import { HttpStatus } from '@nestjs/common';
import { AppError } from './app.error';
import { ErrorCode } from './error-codes';

export class ValidationAppError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, {
      code: ErrorCode.VALIDATION_FAILED,
      status: HttpStatus.BAD_REQUEST,
      details,
    });
  }
}

export class NotFoundAppError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, {
      code: ErrorCode.RESOURCE_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
      details,
    });
  }
}

export class ConflictAppError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(message, {
      code: ErrorCode.CONFLICT,
      status: HttpStatus.CONFLICT,
      details,
    });
  }
}

export class UnauthorizedAppError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, {
      code: ErrorCode.AUTH_UNAUTHORIZED,
      status: HttpStatus.UNAUTHORIZED,
      details,
    });
  }
}

export class ForbiddenAppError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(message, {
      code: ErrorCode.AUTH_FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
      details,
    });
  }
}
