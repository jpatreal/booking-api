import './instrument';

import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { SanitizeInterceptor } from './common/interceptors/sanitize.interceptor';
import { validationExceptionFactory } from './common/validation/validation-exception.factory';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggingInterceptor } from './common/middleware/request-logging.middleware';
import { SentryScopeMiddleware } from './common/middleware/sentry-scope.middleware';
import { ResponseInterceptor } from './common/http/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const reflector = app.get(Reflector);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.use(new RequestIdMiddleware().use);
  const origins = config.get<string[]>('app.cors.origins') ?? [];
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || origin.length === 0 || origins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );
  const showStack =
    config.get<string>('app.showErrorStack') === 'true' ||
    process.env.NODE_ENV !== 'production';
  app.useGlobalFilters(new AllExceptionsFilter(showStack));

  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  app.enableShutdownHooks();

  const denylist = [
    'password',
    'passwordHash',
    'deletedAt',
    'token',
    'tokenHash',
    'refreshToken',
    'twoFactorSecret',
  ];

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new SanitizeInterceptor(app.get(Reflector), denylist),
  );
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));

  app.use(new SentryScopeMiddleware().use);

  const port = config.get<number>('app.port') ?? 4000;
  await app.listen(port);
  const url = await app.getUrl();
  console.log(`${config.get('app.name')} running at ${url}`);
}
bootstrap();
