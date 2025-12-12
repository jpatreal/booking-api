import './instrument';

import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
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
  console.log('BOOT REDIS_URL?', !!process.env.REDIS_URL);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const reflector = app.get(Reflector);
  const config = app.get(ConfigService);

  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.set('trust proxy', 1);

  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));

  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  app.getHttpAdapter().getInstance().disable('x-powered-by');

  app.use(cookieParser());
  app.use(new RequestIdMiddleware().use);
  app.use(new SentryScopeMiddleware().use);

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

  const denylist = [
    'password',
    'passwordHash',
    'deletedAt',
    'disabledAt',
    'token',
    'tokenHash',
    'refreshToken',
    'twoFactorSecret',
  ];

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new SanitizeInterceptor(app.get(Reflector), denylist),
    new ResponseInterceptor(reflector),
  );

  app.enableShutdownHooks();

  const envPort = process.env.PORT ? Number(process.env.PORT) : undefined;
  const port = envPort ?? config.get<number>('app.port') ?? 4000;

  await app.listen(port, '0.0.0.0');
  const url = await app.getUrl();
  console.log(`${config.get('app.name')} running at ${url}`);
}
bootstrap();
