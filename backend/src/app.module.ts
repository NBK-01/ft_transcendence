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
import { InternalUsersModule } from './internal-users/internal-users.module';
import { StaffAuthModule } from './staff-auth/staff-auth.module';
import { AccessControlModule } from './access-control/access-control.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ContactsModule } from './contacts/contacts.module';
import { ChatModule } from './chat/chat.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QueuesModule } from './queues/queues.module';
import { PublicApiModule } from './public-api/public-api.module';
import { WebhooksModule } from './webhooks/webhooks.module';

import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestLoggerMiddleware } from './common/middlewares/request-logger.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AccessControlGuard } from './access-control/guards/access-control.guard';

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
    InternalUsersModule,
    StaffAuthModule,
    AccessControlModule,
    OrganizationsModule,
    ContactsModule,
    ChatModule,
    ShipmentsModule,
    NotificationsModule,
    QueuesModule,
    PublicApiModule,
    WebhooksModule,
    // Domain modules land here as they're built.
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Global, secure-by-default — every route requires a valid JWT unless
    // explicitly marked @Public(). AccessControlGuard runs next, same request
    // (AuthContextService is already populated by then) — fails open unless
    // a route carries an access-control decorator (@RequireStaff() minimum
    // for any staff-only route — see common/decorators/access-control.decorator.ts).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AccessControlGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
