import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * The source template defines JWT_REFRESH_TOKEN_EXPIRES_IN but never
 * actually implements refresh tokens. This entity + RefreshTokenService
 * closes that gap, modeled on eterna-api's design rather than inventing one:
 * one row per session, rotated in place (not replaced), identified by a
 * signed JWT's `jti` claim rather than looked up by hash alone — see
 * RefreshTokenService for why that matters.
 */
@Entity('refresh_token')
export class RefreshToken extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'device_info', type: 'varchar', nullable: true })
  deviceInfo?: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
