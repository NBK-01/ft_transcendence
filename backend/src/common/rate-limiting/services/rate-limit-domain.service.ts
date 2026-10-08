import { Injectable, Inject, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import {
  RateLimitContext,
  RateLimitTier,
  GlobalRateLimitConfig,
} from '../interfaces/rate-limit.interfaces';
import { RateLimitExceededException } from '../exceptions/rate-limit.exceptions';
import { RedisEndpointCacheService } from './redis-endpoint-cache.service';
import { RateLimitErrorHandlerService } from './rate-limit-error-handler.service';

interface StorageWithReset {
  reset(key?: string): Promise<void>;
}

interface StorageWithMap {
  storage: Map<string, unknown>;
}

interface RateLimitCheckParams {
  key: string;
  limit: number;
  ttlMs: number;
  tier: RateLimitTier;
  tierName: string;
  errorMessage: string;
}

/**
 * All tiers are checked, not "either/or" — global, IP, user (if
 * authenticated), and endpoint-specific limits all apply simultaneously to
 * every request. Any one of them tripping is enough to reject the request.
 */
@Injectable()
export class RateLimitDomainService {
  private readonly logger = new Logger(RateLimitDomainService.name);

  constructor(
    @Inject(ThrottlerStorage) private readonly storageService: ThrottlerStorage,
    private readonly redisEndpointCache: RedisEndpointCacheService,
    private readonly errorHandler: RateLimitErrorHandlerService,
  ) {}

  async checkAllRateLimits(
    context: RateLimitContext,
    config: GlobalRateLimitConfig,
    isAuthenticated: boolean = false,
  ): Promise<void> {
    await this.checkGlobalRateLimit(context, config);
    await this.checkIpRateLimit(context, config);

    if (isAuthenticated && context.userId) {
      await this.checkUserRateLimit(context, config);
    }

    await this.checkEndpointRateLimit(context);
  }

  async checkGlobalRateLimit(
    context: RateLimitContext,
    config: GlobalRateLimitConfig,
  ): Promise<void> {
    if (!config.global) {
      return;
    }
    await this.performRateLimitCheck({
      key: 'global',
      limit: config.global.limit,
      ttlMs: config.global.ttl,
      tier: RateLimitTier.GLOBAL,
      tierName: 'global',
      errorMessage: 'Corrupted rate limit state detected',
    });
  }

  async checkIpRateLimit(
    context: RateLimitContext,
    config: GlobalRateLimitConfig,
  ): Promise<void> {
    if (!config.ip) {
      return;
    }
    await this.performRateLimitCheck({
      key: `ip:${context.ip}`,
      limit: config.ip.limit,
      ttlMs: config.ip.ttl,
      tier: RateLimitTier.IP,
      tierName: 'ip',
      errorMessage: `Corrupted rate limit state for IP: ${context.ip}`,
    });
  }

  async checkUserRateLimit(
    context: RateLimitContext,
    config: GlobalRateLimitConfig,
  ): Promise<void> {
    if (!config.authenticated) {
      return;
    }
    await this.performRateLimitCheck({
      key: `user:${context.userId}`,
      limit: config.authenticated.limit,
      ttlMs: config.authenticated.ttl,
      tier: RateLimitTier.AUTHENTICATED,
      tierName: 'authenticated',
      errorMessage: `Corrupted rate limit state for user: ${context.userId}`,
    });
  }

  async checkEndpointRateLimit(
    context: RateLimitContext,
    decoratorRule?: { limit: number; ttl: number; tier?: string },
  ): Promise<void> {
    const endpointRule =
      decoratorRule ??
      (await this.redisEndpointCache.getEndpointRule(
        context.endpoint,
        context.method,
      ));
    if (!endpointRule) {
      return;
    }

    const key = context.userId
      ? `endpoint:${context.endpoint}:${context.method}:user:${context.userId}`
      : `endpoint:${context.endpoint}:${context.method}:ip:${context.ip}`;
    const tier =
      (decoratorRule?.tier as RateLimitTier) ?? RateLimitTier.ENDPOINT;

    await this.performRateLimitCheck({
      key,
      limit: endpointRule.limit,
      ttlMs: endpointRule.ttl,
      tier,
      tierName: tier,
      errorMessage: `Corrupted rate limit state for endpoint: ${context.endpoint}`,
    });
  }

  /**
   * Centralized check + a self-heal path: totalHits === 0 && isBlocked can
   * only happen if the storage record is corrupt (e.g. a bad manual Redis
   * edit) — rather than permanently wedging that key, reset it once and
   * retry before giving up and rejecting the request.
   */
  private async performRateLimitCheck(
    params: RateLimitCheckParams,
  ): Promise<void> {
    const { key, limit, ttlMs, tier, tierName, errorMessage } = params;
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    const result = await this.storageService.increment(
      key,
      ttlSeconds,
      limit,
      ttlSeconds,
      tierName,
    );

    if (result.totalHits === 0 && result.isBlocked) {
      this.errorHandler.handleStorageInconsistency(key, result);
      this.errorHandler.handleStorageReset(key, errorMessage);

      await this.resetStorageKey(key);
      const retried = await this.storageService.increment(
        key,
        ttlSeconds,
        limit,
        ttlSeconds,
        tierName,
      );

      if (retried.totalHits > limit) {
        throw new RateLimitExceededException(
          limit,
          Date.now() + ttlMs,
          ttlSeconds,
          tier,
        );
      }
      return;
    }

    if (result.totalHits > limit) {
      throw new RateLimitExceededException(
        limit,
        Date.now() + ttlMs,
        ttlSeconds,
        tier,
      );
    }
  }

  private hasResetMethod(
    storage: ThrottlerStorage,
  ): storage is ThrottlerStorage & StorageWithReset {
    return typeof (storage as unknown as StorageWithReset).reset === 'function';
  }

  private hasStorageMap(
    storage: ThrottlerStorage,
  ): storage is ThrottlerStorage & StorageWithMap {
    const s = storage as unknown as StorageWithMap;
    return (
      typeof s.storage === 'object' &&
      s.storage instanceof Map &&
      typeof s.storage.delete === 'function'
    );
  }

  private async resetStorageKey(key: string): Promise<void> {
    if (this.hasResetMethod(this.storageService)) {
      try {
        await this.storageService.reset(key);
        return;
      } catch (error) {
        this.logger.warn(
          `Reset method failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (this.hasStorageMap(this.storageService)) {
      try {
        this.storageService.storage.delete(key);
        return;
      } catch (error) {
        this.logger.warn(
          `Storage map deletion failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.warn(
      `Unable to reset storage key ${key}: storage service supports neither reset() nor storage.delete()`,
    );
  }
}
