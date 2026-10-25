import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  DEFAULT_RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
} from '../constants/api-key.constants';

/** One request counted: where its key stands in the current window. */
export interface RateLimitState {
  limit: number;
  remaining: number;
  /** When the window ends (ms since epoch). */
  resetAt: number;
  exceeded: boolean;
}

/**
 * Counts the request and starts the window's clock on its first one, in one
 * round trip. A counter left without an expiry (it shouldn't happen) gets
 * one, so a key can never stay blocked.
 */
const COUNT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

/**
 * The public API's limit per key: PUBLIC_API_RATE_LIMIT requests (60 by
 * default) per fixed one-minute window, counted in Redis so every app
 * instance shares the count. The app-wide limiter (RateLimitingModule) still
 * applies on top, per IP.
 */
@Injectable()
export class ApiKeyRateLimiterService {
  readonly limit: number;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    configService: ConfigService,
  ) {
    this.limit = readLimit(configService);
  }

  /** Throws if Redis can't be reached; the guard decides what that means. */
  async hit(apiKeyId: string): Promise<RateLimitState> {
    const [count, ttl] = (await this.redis.eval(
      COUNT_SCRIPT,
      1,
      `public_api:rate_limit:${apiKeyId}`,
      RATE_LIMIT_WINDOW_MS,
    )) as [number, number];
    return {
      limit: this.limit,
      remaining: Math.max(0, this.limit - count),
      resetAt: Date.now() + ttl,
      exceeded: count > this.limit,
    };
  }
}

/** Checked at boot, so a typo in .env stops the app instead of silently allowing 0 or NaN requests. */
function readLimit(configService: ConfigService): number {
  const raw = configService.get<string | number>('PUBLIC_API_RATE_LIMIT');
  if (raw === undefined || raw === '') {
    return DEFAULT_RATE_LIMIT;
  }
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(
      `PUBLIC_API_RATE_LIMIT must be a whole number of requests per minute, at least 1 (got "${String(raw)}")`,
    );
  }
  return limit;
}
