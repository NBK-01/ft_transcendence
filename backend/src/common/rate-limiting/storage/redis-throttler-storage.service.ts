import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

/**
 * Redis-backed ThrottlerStorage, swapped in for @nestjs/throttler's default
 * in-memory storage — see rate-limiting.module.ts. All tiers (global, IP,
 * user, endpoint) go through this, so limits are consistent across
 * instances instead of being per-process.
 *
 * Redis-only, no in-memory fallback: if Redis is down, increment() throws
 * and the caller (RateLimitDomainService, via the guard) fails open rather
 * than taking the API down.
 */
@Injectable()
export class RedisThrottlerStorageService
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(RedisThrottlerStorageService.name);
  private readonly keyPrefix = 'rate_limit';

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.logger.log(
      'Redis rate limiting storage service initialized (Redis-only mode)',
    );
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    return this.incrementRedis(
      `${this.keyPrefix}:${key}`,
      ttl,
      limit,
      blockDuration,
      throttlerName,
    );
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      await this.redis.del(`${this.keyPrefix}:${key}`);
    } else {
      await this.scanAndDeleteKeys(`${this.keyPrefix}:*`);
    }
  }

  /**
   * Single atomic round-trip: read current count, decide if this hit tips it
   * over the limit, write the new state, set expiry — all inside one Lua
   * script so concurrent requests against the same key can't race each
   * other into under-counting.
   */
  private async incrementRedis(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    const expireTime = now + ttl * 1000;
    const blockExpireTime = now + blockDuration * 1000;
    const maxExpireSeconds = Math.max(Math.ceil(ttl), Math.ceil(blockDuration));

    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local expireTime = tonumber(ARGV[2])
      local blockExpireTime = tonumber(ARGV[3])
      local limit = tonumber(ARGV[4])
      local throttlerName = ARGV[5]
      local maxExpireSeconds = tonumber(ARGV[6])

      local currentData = redis.call('HMGET', key, 'totalHits', 'timeToExpire')
      local currentHits = tonumber(currentData[1]) or 0
      local currentExpire = tonumber(currentData[2]) or 0

      local totalHits
      local timeToExpire

      if currentExpire > now then
        totalHits = currentHits + 1
        timeToExpire = currentExpire
      else
        totalHits = 1
        timeToExpire = expireTime
      end

      local isBlocked = totalHits > limit
      local timeToBlockExpire = isBlocked and blockExpireTime or timeToExpire

      redis.call('HMSET', key,
        'totalHits', totalHits,
        'timeToExpire', timeToExpire,
        'throttlerName', throttlerName,
        'lastUpdate', now
      )
      redis.call('EXPIRE', key, maxExpireSeconds)

      return {totalHits, timeToExpire, isBlocked and 1 or 0, timeToBlockExpire}
    `;

    const result = (await this.redis.eval(
      luaScript,
      1,
      key,
      now.toString(),
      expireTime.toString(),
      blockExpireTime.toString(),
      limit.toString(),
      throttlerName,
      maxExpireSeconds.toString(),
    )) as [number, number, number, number];

    return {
      totalHits: result[0],
      timeToExpire: result[1],
      isBlocked: result[2] === 1,
      timeToBlockExpire: result[3],
    };
  }

  onModuleDestroy(): void {
    // Shared Redis client lifecycle is owned by GlobalRedisModule — nothing to clean up here.
  }

  async getStorageSize(): Promise<number> {
    try {
      return await this.scanAndCountKeys(`${this.keyPrefix}:*`);
    } catch {
      this.logger.warn('Failed to get storage size from Redis');
      return 0;
    }
  }

  private async scanAndDeleteKeys(pattern: string): Promise<void> {
    const keys = await this.scanKeys(pattern);
    const batchSize = 1000;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      if (batch.length > 0) {
        await this.redis.del(...batch);
      }
    }
  }

  private async scanAndCountKeys(pattern: string): Promise<number> {
    return (await this.scanKeys(pattern)).length;
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
}
