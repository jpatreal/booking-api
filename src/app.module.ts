import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SentryModule } from '@sentry/nestjs/setup';
import { HealthModule } from './health/health.module';
import appConfig from './config/app.config';
import { RequestLogger } from './common/middleware/request-logger.middleware';
import { ServicesModule } from './services/services.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MembershipsModule } from './memberships/memberships.module';
import { BusinessesModule } from './businesses/businesses.module';
import { DbModule } from './db/db.module';
import { StaffModule } from './staff/staff.module';
import { AdminModule } from './admin/admin.module';
import { LimitsModule } from './billing/limits.module';
import { BookingsModule } from './bookings/bookings.module';
import { RedisModule } from './redis/redis.module';
import { AppCacheModule } from './cache/cache.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { OutboxModule } from './outbox/outbox.module';
import { GlobalRateLimitMiddleware } from './common/middleware/global-rl.middleware';
import { RateLimitService } from './common/rate-limit/rate-limit.service';

@Module({
  imports: [
    AppCacheModule,
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env'],
    }),
    DbModule,
    HealthModule,
    ServicesModule,
    AuthModule,
    UsersModule,
    MembershipsModule,
    BusinessesModule,
    StaffModule,
    AdminModule,
    LimitsModule,
    BookingsModule,
    RedisModule,
    AuditLogModule,
    OutboxModule,
  ],
  controllers: [AppController],
  providers: [AppService, RateLimitService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLogger).forRoutes('*');
    consumer.apply(GlobalRateLimitMiddleware).forRoutes('*');
  }
}
