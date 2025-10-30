import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: unknown;
  public readonly cause?: unknown;

  constructor(
    message: string,
    {
      code = ErrorCode.INTERNAL_ERROR,
      status = HttpStatus.INTERNAL_SERVER_ERROR,
      details,
      cause,
    }: {
      code?: ErrorCode;
      status?: number;
      details?: unknown;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
    this.cause = cause;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
