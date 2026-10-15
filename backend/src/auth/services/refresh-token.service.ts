import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../../users/user.entity';
import {
  TokenType,
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../interfaces/jwt-payload.interface';
import { jwtConfig } from '../../config/jwt.config';
import { parseDuration } from '../../common/utils/parse-duration';
import { AccountType } from '../../common/context/auth-context.types';
import {
  InvalidRefreshTokenException,
  RefreshTokenExpiredException,
  SessionInvalidatedException,
} from '../exceptions/auth-exceptions';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenMetadata {
  deviceInfo?: string;
  ipAddress?: string;
}

/**
 * Refresh tokens are `{signedJWT}.{rawToken}` — a real JWT (carrying `sub`,
 * `type: REFRESH`, and `jti` = the RefreshToken row id) concatenated with a
 * random secret. Validating a token requires BOTH halves to check out: a
 * validly-signed, unexpired JWT (which says *which* row to look at) and a
 * matching hash of the raw suffix (the actual bearer secret). A leaked DB
 * (hashes only) can't be replayed without the JWT secret; a forged/guessed
 * jti can't be used without the matching raw secret either.
 *
 * Rotation UPDATEs the same row instead of inserting a new one each time —
 * one row per "session" for its whole lifetime, no revoked-row buildup.
 */
@Injectable()
export class RefreshTokenService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly refreshTokenExpiresInMs: number;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly repository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
  ) {
    const config = jwtConfig();
    this.accessTokenExpiresIn = config.accessTokenExpiresIn;
    this.refreshTokenExpiresIn = config.refreshTokenExpiresIn;
    this.refreshTokenExpiresInMs = parseDuration(this.refreshTokenExpiresIn);
  }

  /** New session (login/register/verify-otp) — creates a new DB row. */
  async generateTokenPair(
    user: User,
    metadata?: TokenMetadata,
  ): Promise<TokenPair> {
    const { rawToken, tokenHash, expiresAt } = this.generateTokenData();

    const record = await this.repository.save({
      userId: user.id,
      tokenHash,
      deviceInfo: metadata?.deviceInfo?.substring(0, 255) || null,
      ipAddress: metadata?.ipAddress?.substring(0, 45) || null,
      expiresAt,
    });

    return this.buildTokenPair(user, record.id, rawToken);
  }

  /** Same session, new secret — UPDATEs the existing row, `jti` stays the same. */
  async rotateRefreshToken(
    tokenRecord: RefreshToken,
    user: User,
    metadata?: TokenMetadata,
  ): Promise<TokenPair> {
    const { rawToken, tokenHash, expiresAt } = this.generateTokenData();

    await this.repository.update(tokenRecord.id, {
      tokenHash,
      expiresAt,
      deviceInfo:
        metadata?.deviceInfo?.substring(0, 255) || tokenRecord.deviceInfo,
      ipAddress: metadata?.ipAddress?.substring(0, 45) || tokenRecord.ipAddress,
    });

    return this.buildTokenPair(user, tokenRecord.id, rawToken);
  }

  /** Verifies the JWT half, then the raw-secret hash, then expiry/force-logout — in that order. */
  async validateRefreshToken(token: string, user: User): Promise<RefreshToken> {
    const parts = token.split('.');
    if (parts.length !== 4) {
      // 3 JWT parts + 1 raw token suffix
      throw new InvalidRefreshTokenException();
    }

    const refreshJwt = parts.slice(0, 3).join('.');
    const rawToken = parts[3];

    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshJwt);
    } catch {
      throw new InvalidRefreshTokenException();
    }

    if (payload.type !== TokenType.REFRESH || payload.sub !== user.id) {
      throw new InvalidRefreshTokenException();
    }

    const tokenRecord = await this.repository.findOne({
      where: { id: payload.jti, userId: user.id },
    });
    if (!tokenRecord) {
      throw new InvalidRefreshTokenException();
    }

    if (tokenRecord.tokenHash !== this.hashToken(rawToken)) {
      throw new InvalidRefreshTokenException();
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new RefreshTokenExpiredException();
    }

    if (
      user.forceLogoutAfter &&
      tokenRecord.createdAt < user.forceLogoutAfter
    ) {
      throw new SessionInvalidatedException();
    }

    return tokenRecord;
  }

  /** Logout — invalidate this one session. */
  async deleteToken(tokenId: string): Promise<void> {
    await this.repository.delete({ id: tokenId });
  }

  /** Logout everywhere — invalidate every session for this user. */
  async deleteAllUserTokens(userId: string): Promise<number> {
    const result = await this.repository.delete({ userId });
    return result.affected || 0;
  }

  private generateTokenData(): {
    rawToken: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const rawToken = randomBytes(32).toString('hex');
    return {
      rawToken,
      tokenHash: this.hashToken(rawToken),
      expiresAt: new Date(Date.now() + this.refreshTokenExpiresInMs),
    };
  }

  private buildTokenPair(
    user: User,
    tokenRecordId: string,
    rawToken: string,
  ): TokenPair {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      type: TokenType.ACCESS,
      accountType: AccountType.CUSTOMER,
    };
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.accessTokenExpiresIn,
    } as JwtSignOptions);

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      type: TokenType.REFRESH,
      accountType: AccountType.CUSTOMER,
      jti: tokenRecordId,
    };
    const refreshJwt = this.jwtService.sign(refreshPayload, {
      expiresIn: this.refreshTokenExpiresIn,
    } as JwtSignOptions);

    return { accessToken, refreshToken: `${refreshJwt}.${rawToken}` };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
