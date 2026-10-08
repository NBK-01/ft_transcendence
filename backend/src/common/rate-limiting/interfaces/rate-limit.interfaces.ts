import { Request } from 'express';

export interface RateLimitRule {
  ttl: number;
  limit: number;
  /**
   * Optional function to conditionally skip rate limiting for specific requests.
   * Keep it lightweight — evaluated on every request, no async/DB work.
   */
  skipIf?: (req: Request) => boolean;
}

export interface GlobalRateLimitConfig {
  global: RateLimitRule;
  ip: RateLimitRule;
  authenticated: RateLimitRule;
}

export interface RateLimitContext {
  ip: string;
  userId?: string;
  endpoint: string;
  method: string;
  userAgent?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export enum RateLimitTier {
  GLOBAL = 'global',
  IP = 'ip',
  AUTHENTICATED = 'authenticated',
  ENDPOINT = 'endpoint',
  INTERNAL = 'internal',
}

export interface RateLimitViolation {
  context: RateLimitContext;
  tier: RateLimitTier;
  limit: number;
  attempts: number;
  timestamp: Date;
}
