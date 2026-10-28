import { ConfigService } from '@nestjs/config';
import { QueueOptions } from 'bullmq';

/**
 * BullMQ's own Redis connection, from the same REDIS_* variables as the rest
 * of the app. Not the shared @nestjs-modules/ioredis client: that one fails
 * fast (no retries, 2s timeout) for rate limiting, while BullMQ's workers
 * keep blocking commands open and need ioredis to retry, never give up
 * (maxRetriesPerRequest: null). With the default offline queue, a job added
 * while Redis is down waits in memory and goes out when it's back.
 */
export function bullmqConfig(config: ConfigService): QueueOptions {
  return {
    connection: {
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: Number(config.get('REDIS_PORT', 6379)),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      tls: config.get('REDIS_TLS') === 'true' ? {} : undefined,
      maxRetriesPerRequest: null,
    },
    prefix: 'bull',
  };
}
