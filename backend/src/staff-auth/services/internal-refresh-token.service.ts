import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { InternalRefreshToken } from '../entities/internal-refresh-token.entity';
import { InternalUser } from '../../internal-users/internal-user.entity';
import {
  TokenType,
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../../auth/interfaces/jwt-payload.interface';
import { AccountType } from '../../common/context/auth-context.types';
import { jwtConfig } from '../../config/jwt.config';
import { parseDuration } from '../../common/utils/parse-duration';
import {
  InvalidStaffRefreshTokenException,
  StaffRefreshTokenExpiredException,
  StaffSessionInvalidatedException,
} from '../exceptions';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenMetadata {
  deviceInfo?: string;
  ipAddress?: string;
}

/**
 * Structural port of src/auth/services/refresh-token.service.ts — same
 * JWT+raw-token hybrid, same rotate-in-place design — operating on the
 * separate `internal_refresh_token` table and InternalUser instead.
 */
@Injectable()
export class InternalRefreshTokenService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly refreshTokenExpiresInMs: number;

  constructor(
    @InjectRepository(InternalRefreshToken)
    private readonly repository: Repository<InternalRefreshToken>,
    private readonly jwtService: JwtService,
  ) {
    const config = jwtConfig();
    this.accessTokenExpiresIn = config.accessTokenExpiresIn;
    this.refreshTokenExpiresIn = config.refreshTokenExpiresIn;
    this.refreshTokenExpiresInMs = parseDuration(this.refreshTokenExpiresIn);
  }

  async generateTokenPair(
    user: InternalUser,
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

  async rotateRefreshToken(
    tokenRecord: InternalRefreshToken,
    user: InternalUser,
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

  async validateRefreshToken(
    token: string,
    user: InternalUser,
  ): Promise<InternalRefreshToken> {
    const parts = token.split('.');
    if (parts.length !== 4) {
      throw new InvalidStaffRefreshTokenException();
    }

    const refreshJwt = parts.slice(0, 3).join('.');
    const rawToken = parts[3];

    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshJwt);
    } catch {
      throw new InvalidStaffRefreshTokenException();
    }

    if (
      payload.type !== TokenType.REFRESH ||
      payload.accountType !== AccountType.STAFF ||
      payload.sub !== user.id
    ) {
      throw new InvalidStaffRefreshTokenException();
    }

    const tokenRecord = await this.repository.findOne({
      where: { id: payload.jti, userId: user.id },
    });
    if (!tokenRecord) {
      throw new InvalidStaffRefreshTokenException();
    }

    if (tokenRecord.tokenHash !== this.hashToken(rawToken)) {
      throw new InvalidStaffRefreshTokenException();
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new StaffRefreshTokenExpiredException();
    }

    if (
      user.forceLogoutAfter &&
      tokenRecord.createdAt < user.forceLogoutAfter
    ) {
      throw new StaffSessionInvalidatedException();
    }

    return tokenRecord;
  }

  async deleteToken(tokenId: string): Promise<void> {
    await this.repository.delete({ id: tokenId });
  }

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
    user: InternalUser,
    tokenRecordId: string,
    rawToken: string,
  ): TokenPair {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      type: TokenType.ACCESS,
      accountType: AccountType.STAFF,
    };
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.accessTokenExpiresIn,
    } as JwtSignOptions);

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      type: TokenType.REFRESH,
      accountType: AccountType.STAFF,
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
