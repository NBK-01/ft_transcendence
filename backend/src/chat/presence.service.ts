import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AccountType } from '../common/context/auth-context.types';

const PRESENCE_TTL_SECONDS = 90;

/** How often a connected socket refreshes its presence: well inside the TTL. */
export const PRESENCE_HEARTBEAT_MS = 30_000;
const PRESENCE_KEY_PREFIX = 'presence';

/**
 * Backed by the existing shared Redis client (same one rate-limiting/OAuth
 * codes already use). TTL'd rather than relying solely on a clean
 * disconnect — an unclean one (process killed, not a graceful close) would
 * otherwise leave a stale "online" entry forever. ChatGateway refreshes it
 * on every inbound event and on a heartbeat (PRESENCE_HEARTBEAT_MS), so the
 * TTL never lapses while a connection is alive, even an idle one.
 */
@Injectable()
export class PresenceService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async markOnline(
    accountType: AccountType,
    accountId: string,
    socketId: string,
  ): Promise<void> {
    const key = this.presenceKey(accountType, accountId);
    await this.redis.sadd(key, socketId);
    await this.redis.expire(key, PRESENCE_TTL_SECONDS);
  }

  async refreshPresence(
    accountType: AccountType,
    accountId: string,
  ): Promise<void> {
    await this.redis.expire(
      this.presenceKey(accountType, accountId),
      PRESENCE_TTL_SECONDS,
    );
  }

  /** Returns true once nobody's left connected for this account — the caller broadcasts offline only then. */
  async markOffline(
    accountType: AccountType,
    accountId: string,
    socketId: string,
  ): Promise<boolean> {
    const key = this.presenceKey(accountType, accountId);
    await this.redis.srem(key, socketId);
    const remaining = await this.redis.scard(key);
    return remaining === 0;
  }

  async isOnline(
    accountType: AccountType,
    accountId: string,
  ): Promise<boolean> {
    const count = await this.redis.scard(
      this.presenceKey(accountType, accountId),
    );
    return count > 0;
  }

  /** Which of these accounts are online, in one round trip. */
  async onlineAmong(
    accountType: AccountType,
    accountIds: string[],
  ): Promise<Set<string>> {
    if (!accountIds.length) {
      return new Set();
    }
    const pipeline = this.redis.pipeline();
    for (const id of accountIds) {
      pipeline.scard(this.presenceKey(accountType, id));
    }
    const counts = (await pipeline.exec()) ?? [];
    return new Set(
      accountIds.filter((_, index) => Number(counts[index]?.[1] ?? 0) > 0),
    );
  }

  private presenceKey(accountType: AccountType, accountId: string): string {
    return `${PRESENCE_KEY_PREFIX}:${accountType}:${accountId}`;
  }
}
