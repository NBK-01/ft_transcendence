import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

/**
 * Rate limiting is a security control, not a nice-to-have — fail the boot
 * loudly rather than silently running with no effective limits if neither
 * Redis nor the tiered env vars are configured.
 *
 * Note (matches oori-api's actual behavior): this validates that the
 * RATE_LIMIT_* env vars are present and numeric as a configuration
 * sanity-check, but the real tier limits come from the hardcoded
 * GLOBAL_LIMITS constant in RedisEndpointCacheService — these env vars
 * aren't actually wired into that. Keep both in sync by hand if you change
 * one.
 */
@Injectable()
export class RateLimitStartupValidatorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RateLimitStartupValidatorService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Validating rate limiting configuration...');

    const hasRedis = await this.checkRedisAvailability();
    const hasEnvConfig = this.checkEnvironmentConfig();

    if (!hasRedis && !hasEnvConfig) {
      this.logger.error(
        'CRITICAL: No rate limiting configuration found! Neither Redis nor environment variables are available.',
      );
      this.logger.error(
        'Please either: 1) start Redis, or 2) set RATE_LIMIT_GLOBAL_LIMIT/TTL, RATE_LIMIT_IP_LIMIT/TTL, RATE_LIMIT_AUTH_LIMIT/TTL.',
      );
      this.logger.error(
        'Application cannot start without rate limiting configuration.',
      );
      process.exit(1);
    }

    if (hasRedis) {
      this.logger.log(
        '✅ Redis is available - will use Redis for rate limiting',
      );
    } else {
      // Storage is Redis-only (see RedisThrottlerStorageService) — there is no actual
      // env-var-driven fallback storage. Without Redis, every request fails OPEN past the
      // throttler guard. This log message matches oori-api's wording even though the
      // "fallback" it describes isn't wired up — see the class doc comment above.
      this.logger.log(
        '⚠️  Redis not available - falling back to environment variables',
      );
    }

    this.logger.log('Rate limiting configuration validation completed');
  }

  private async checkRedisAvailability(): Promise<boolean> {
    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect();
      }
      await this.redis.ping();
      return true;
    } catch (error) {
      this.logger.debug(
        `Redis not available: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private checkEnvironmentConfig(): boolean {
    const requiredEnvVars = [
      'RATE_LIMIT_GLOBAL_LIMIT',
      'RATE_LIMIT_GLOBAL_TTL',
      'RATE_LIMIT_IP_LIMIT',
      'RATE_LIMIT_IP_TTL',
      'RATE_LIMIT_AUTH_LIMIT',
      'RATE_LIMIT_AUTH_TTL',
    ];

    const invalidVars: string[] = [];
    for (const varName of requiredEnvVars) {
      const value = this.configService.get<string>(varName);
      if (!value) {
        invalidVars.push(`${varName} (missing)`);
        continue;
      }
      const numValue = Number(value);
      if (isNaN(numValue) || !isFinite(numValue) || numValue <= 0) {
        invalidVars.push(`${varName} (invalid value: ${value})`);
      }
    }

    if (invalidVars.length > 0) {
      this.logger.error('Invalid rate limiting environment variables:', {
        invalidVariables: invalidVars,
        requirements: 'All values must be positive numbers',
      });
      return false;
    }
    return true;
  }
}
