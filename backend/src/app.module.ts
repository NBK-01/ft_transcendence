import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClsModule } from 'nestjs-cls';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { v4 as uuid } from 'uuid';
import { Request, Response } from 'express';

import { GlobalRedisModule } from './common/redis/redis.module';
import { DatabaseModule } from './database/database.module';
import { RateLimitingModule } from './common/rate-limiting';
import { AuthContextModule } from './common/context';
import { I18nModule } from './i18n/i18n.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { CommunicationModule } from './communication/communication.module';
import { UsersModule } from './users/users.module';
import { OtpModule } from './otp/otp.module';
import { AuthModule } from './auth/auth.module';

import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestLoggerMiddleware } from './common/middlewares/request-logger.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    EventEmitterModule.forRoot(),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: Request) =>
          (req.headers['x-request-id'] as string) || uuid(),
        setup: (_cls, _req: Request, res: Response) => {
          res.setHeader('x-request-id', _cls.getId());
        },
      },
    }),
    GlobalRedisModule,
    DatabaseModule,
    RateLimitingModule,
    AuthContextModule,
    I18nModule,
    HealthModule,
    CommonModule,
    CommunicationModule,
    UsersModule,
    OtpModule,
    AuthModule,
    // Domain modules land here as they're built:
    // AccessControlModule (RBAC), OrganizationsModule, ShipmentsModule,
    // NotificationsModule, QueuesModule, FileStorageModule
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Global, secure-by-default — every route requires a valid JWT unless
    // explicitly marked @Public(). AccessControlGuard (RBAC) joins this list
    // once the Role/Permission module exists.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
