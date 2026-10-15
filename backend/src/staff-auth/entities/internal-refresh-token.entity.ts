import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * Staff sessions — deliberately a separate table from the customer
 * `refresh_token` table (same shape as src/auth/entities/refresh-token.entity.ts),
 * so a staff session is never a row a customer-auth code path could touch.
 */
@Entity('internal_refresh_token')
export class InternalRefreshToken extends BaseEntity {
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
