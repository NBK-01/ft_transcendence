import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

/**
 * Short-lived, one-time authorization code bridging the OAuth redirect to
 * the token-exchange call — the browser never carries a real access/refresh
 * token in a URL (history, logs, referrer headers, proxies all see it
 * otherwise). See AuthService.handleGoogleCallback/exchangeOAuthCode.
 */
@Injectable()
export class OAuthCodeService {
  private readonly keyPrefix = 'oauth-code';
  private readonly ttlSeconds = 300;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async generateCode(userId: string): Promise<string> {
    const code = randomUUID();
    await this.redis.setex(this.key(code), this.ttlSeconds, userId);
    return code;
  }

  /** One-time use — deletes on read. Returns null if missing/expired/already consumed. */
  async consumeCode(code: string): Promise<string | null> {
    const userId = await this.redis.get(this.key(code));
    if (!userId) {
      return null;
    }
    await this.redis.del(this.key(code));
    return userId;
  }

  private key(code: string): string {
    return `${this.keyPrefix}:${code}`;
  }
}
