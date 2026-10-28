import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';

/**
 * Single ioredis client, app-wide. Fail-fast config so a Redis outage
 * degrades individual requests (rate-limiting, cache) instead of hanging
 * them or blocking app boot — lazyConnect means we don't even try to
 * connect until the first command.
 */
@Global()
@Module({
  imports: [
    NestRedisModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: `redis://:${config.get('REDIS_PASSWORD', '')}@${config.get('REDIS_HOST', 'localhost')}:${config.get('REDIS_PORT', 6379)}`,
        options: {
          lazyConnect: true,
          maxRetriesPerRequest: 0,
          enableOfflineQueue: false,
          connectTimeout: 2000,
          commandTimeout: 2000,
          tls:
            config.get('REDIS_TLS') === 'true'
              ? { rejectUnauthorized: false }
              : undefined,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [NestRedisModule],
})
export class GlobalRedisModule {}
