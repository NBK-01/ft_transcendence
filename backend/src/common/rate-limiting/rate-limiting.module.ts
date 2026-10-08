import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { RateLimitDomainService } from './services/rate-limit-domain.service';
import { RateLimitErrorHandlerService } from './services/rate-limit-error-handler.service';
import { RateLimitStartupValidatorService } from './services/rate-limit-startup-validator.service';
import { RedisEndpointCacheService } from './services/redis-endpoint-cache.service';
import { RedisThrottlerStorageService } from './storage/redis-throttler-storage.service';
import { RateLimitResponseFactory } from './factories/rate-limit-response.factory';
import { EnhancedThrottlerGuard } from './guards/enhanced-throttler.guard';

@Global()
@Module({
  imports: [
    // Default-throttler config here is unused — tier limits come from
    // RedisEndpointCacheService (env-driven) via RateLimitDomainService, and
    // storage is swapped to Redis below. ThrottlerModule.forRoot is only
    // here because EnhancedThrottlerGuard extends ThrottlerGuard, which
    // needs ThrottlerModuleOptions injectable.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
    }),
  ],
  providers: [
    RateLimitDomainService,
    RateLimitErrorHandlerService,
    RateLimitStartupValidatorService,
    RedisEndpointCacheService,
    RedisThrottlerStorageService,
    RateLimitResponseFactory,
    EnhancedThrottlerGuard,
    {
      provide: ThrottlerStorage,
      useFactory: (redisStorage: RedisThrottlerStorageService) => redisStorage,
      inject: [RedisThrottlerStorageService],
    },
    { provide: APP_GUARD, useClass: EnhancedThrottlerGuard },
  ],
  exports: [
    RateLimitDomainService,
    RateLimitErrorHandlerService,
    RedisEndpointCacheService,
    ThrottlerModule,
  ],
})
export class RateLimitingModule {}
