import { SetMetadata } from '@nestjs/common';
import { Request } from 'express';

export const RATE_LIMIT_KEY = 'rate-limit';
export const SKIP_RATE_LIMIT_KEY = 'skip-rate-limit';

export interface RateLimitOptions {
  limit?: number;
  ttl?: number;
  skipIf?: (req: Request) => boolean;
  tier?: 'global' | 'ip' | 'authenticated' | 'endpoint';
}

/** Set a specific rate limit for an endpoint, layered on top of the global/IP/user tiers. */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/** Skip rate limiting for an endpoint, optionally only when `condition` is true. */
export const SkipRateLimit = (condition?: (req: Request) => boolean) =>
  SetMetadata(SKIP_RATE_LIMIT_KEY, condition ?? true);

/** Strict limit for sensitive endpoints. Default: ttl in ms. */
export const StrictRateLimit = (limit: number, ttl: number = 60000) =>
  RateLimit({ limit, ttl, tier: 'endpoint' });

/** For payment/checkout-style endpoints. Default: 5 requests / 5 minutes. */
export const FinancialRateLimit = (limit: number = 5, ttl: number = 300000) =>
  RateLimit({ limit, ttl, tier: 'endpoint' });

/** For file upload endpoints. Default: 3 uploads / 5 minutes. */
export const UploadRateLimit = (limit: number = 3, ttl: number = 300000) =>
  RateLimit({ limit, ttl, tier: 'endpoint' });

/** For login/signup/OTP endpoints. Default: 10 attempts / hour, tracked by IP. */
export const AuthRateLimit = (limit: number = 10, ttl: number = 3600000) =>
  RateLimit({ limit, ttl, tier: 'ip' });
