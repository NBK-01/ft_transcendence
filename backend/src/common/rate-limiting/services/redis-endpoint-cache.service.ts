import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  RateLimitRule,
  GlobalRateLimitConfig,
} from '../interfaces/rate-limit.interfaces';

@Injectable()
export class RedisEndpointCacheService {
  // Global rate limits (constants — intentionally NOT read from the
  // RATE_LIMIT_GLOBAL_LIMIT/TTL etc. env vars; those are validated for
  // presence by RateLimitStartupValidatorService but don't feed these
  // numbers. Matches oori-api's actual behavior — change these values here
  // directly if the tiers need to move.)
  private readonly GLOBAL_LIMITS: GlobalRateLimitConfig = {
    global: { limit: 10_000_000, ttl: 60_000 },
    ip: { limit: 1000, ttl: 60_000 },
    authenticated: { limit: 500, ttl: 60_000 },
  };

  // Default endpoint rules, keyed "METHOD:url-pattern" (wildcard '*' supported). Empty by
  // default — add per-endpoint overrides here as routes need stricter-than-default limits.
  private readonly DEFAULT_RULES = new Map<string, RateLimitRule>([]);

  // In-memory cache of Redis-sourced per-endpoint overrides, reloaded on each getEndpointRule()
  // miss against DEFAULT_RULES — lets you add/change endpoint limits without a redeploy.
  private redisPatterns = new Map<string, RateLimitRule>();

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /** Constants -> Redis override -> null (skip rate limiting for this endpoint). */
  async getEndpointRule(
    url: string,
    method: string,
  ): Promise<RateLimitRule | null> {
    const defaultRule = this.getDefaultRule(url, method);
    if (defaultRule) {
      return defaultRule;
    }

    await this.loadRedisPatterns();
    return this.getRedisRuleFromMemory(url, method);
  }

  getGlobalConfig(): GlobalRateLimitConfig {
    return this.GLOBAL_LIMITS;
  }

  private async loadRedisPatterns(): Promise<void> {
    const keys = await this.scanKeys('rate_limit_rule:*');
    this.redisPatterns.clear();

    for (const key of keys) {
      const rule = await this.redis.get(key);
      if (rule) {
        const pattern = key.replace('rate_limit_rule:', '');
        this.redisPatterns.set(pattern, JSON.parse(rule) as RateLimitRule);
      }
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    const batchSize = 100;

    do {
      const [nextCursor, foundKeys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        batchSize,
      );
      cursor = nextCursor;
      if (foundKeys.length > 0) {
        keys.push(...foundKeys);
      }
    } while (cursor !== '0');

    return keys;
  }

  private getDefaultRule(url: string, method: string): RateLimitRule | null {
    for (const [pattern, rule] of this.DEFAULT_RULES) {
      const [patternMethod, patternUrl] = pattern.split(':', 2);
      if (
        (patternMethod === '*' || patternMethod === method) &&
        this.wildcardMatch(url, patternUrl)
      ) {
        return rule;
      }
    }
    return null;
  }

  private getRedisRuleFromMemory(
    url: string,
    method: string,
  ): RateLimitRule | null {
    const exactPattern = `${method}:${url}`;
    const exact = this.redisPatterns.get(exactPattern);
    if (exact) {
      return exact;
    }

    for (const [pattern, rule] of this.redisPatterns) {
      const [patternMethod, patternUrl] = pattern.split(':', 2);
      if (
        (patternMethod === '*' || patternMethod === method) &&
        this.wildcardMatch(url, patternUrl)
      ) {
        return rule;
      }
    }
    return null;
  }

  /** Simple `*`-wildcard matcher (DP-based, same semantics as shell globbing on one segment). */
  private wildcardMatch(text: string, pattern: string): boolean {
    const textLen = text.length;
    const patternLen = pattern.length;
    const dp: boolean[][] = Array.from(
      { length: textLen + 1 },
      () => Array(patternLen + 1).fill(false) as boolean[],
    );
    dp[0][0] = true;

    for (let j = 1; j <= patternLen; j++) {
      if (pattern[j - 1] === '*') {
        dp[0][j] = dp[0][j - 1];
      }
    }

    for (let i = 1; i <= textLen; i++) {
      for (let j = 1; j <= patternLen; j++) {
        if (pattern[j - 1] === '*') {
          dp[i][j] = dp[i - 1][j] || dp[i][j - 1];
        } else if (pattern[j - 1] === text[i - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        }
      }
    }

    return dp[textLen][patternLen];
  }
}
