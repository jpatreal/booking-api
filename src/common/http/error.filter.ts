import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let code: string | number | undefined;
    let errors: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse() as any;
      message = r?.message || exception.message || message;
      if (r?.code) code = r.code;
      if (r?.errors) errors = r.errors;
    } else if (exception && typeof exception === 'object') {
      message = (exception as any).message || message;
    }

    res.status(status).json({ success: false, message, code, errors });
  }
}
