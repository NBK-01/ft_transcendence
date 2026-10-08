import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * The source template defines JWT_REFRESH_TOKEN_EXPIRES_IN but never
 * actually implements refresh tokens — login() just signs a single
 * short-lived access token with no way to renew it. This entity + the
 * refresh/rotate flow in auth.service.ts closes that gap.
 *
 * Stores a hash of the token, never the raw value — same reasoning as
 * password storage, so a DB leak doesn't hand out usable sessions.
 */
@Entity('refresh_token')
export class RefreshToken extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'token_hash', unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
