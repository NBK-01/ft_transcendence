import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { RefreshToken } from '../entities/refresh-token.entity';
import { jwtConfig } from '../../config/jwt.config';
import { parseDuration } from '../../common/utils/parse-duration';
import { InvalidRefreshTokenException } from '../exceptions/auth-exceptions';

/**
 * Raw tokens are only ever returned to the caller once, at issuance — we
 * store a SHA-256 hash (fast, deterministic — needed for lookup-by-value,
 * unlike password hashing) so a DB leak alone can't be replayed as a
 * session.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repository: Repository<RefreshToken>,
  ) {}

  async issue(userId: string): Promise<string> {
    const rawToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + this.expiresInMs());

    await this.repository.save({
      userId,
      tokenHash: this.hash(rawToken),
      expiresAt,
      revokedAt: null,
    });

    return rawToken;
  }

  /** Validates, revokes the old token, and issues a new one (rotation — a used refresh token can't be replayed). */
  async rotate(
    rawToken: string,
  ): Promise<{ userId: string; newToken: string }> {
    const record = await this.repository.findOne({
      where: { tokenHash: this.hash(rawToken) },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new InvalidRefreshTokenException();
    }

    await this.repository.update(record.id, { revokedAt: new Date() });
    const newToken = await this.issue(record.userId);
    return { userId: record.userId, newToken };
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repository.update(
      { userId, revokedAt: undefined },
      { revokedAt: new Date() },
    );
  }

  private hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private expiresInMs(): number {
    return parseDuration(jwtConfig().refreshTokenExpiresIn);
  }
}
