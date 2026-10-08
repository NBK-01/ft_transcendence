import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';

@Injectable()
export class PasswordResetService {
  private readonly RESET_TOKEN_PREFIX = 'password-reset';
  private readonly TOKEN_TTL = 900; // 15 minutes

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async generateResetToken(email: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.redis.setex(
      this.getRedisKey(token),
      this.TOKEN_TTL,
      email.toLowerCase().trim(),
    );
    return token;
  }

  async verifyResetToken(token: string): Promise<string | null> {
    return this.redis.get(this.getRedisKey(token));
  }

  async invalidateToken(token: string): Promise<void> {
    await this.redis.del(this.getRedisKey(token));
  }

  getTokenExpiryMinutes(): number {
    return this.TOKEN_TTL / 60;
  }

  private getRedisKey(token: string): string {
    return `${this.RESET_TOKEN_PREFIX}:${token}`;
  }
}
