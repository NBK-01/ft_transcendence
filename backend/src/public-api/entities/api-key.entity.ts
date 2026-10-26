import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Organization } from '../../organizations/organization.entity';
import { InternalUser } from '../../internal-users/internal-user.entity';

/**
 * A key a partner system sends to call the public API for one branch. A
 * branch can hold several, so a key is replaced without downtime: create the
 * new one, switch the partner over, revoke the old one.
 *
 * The key itself is never stored. keyHmac finds the row, keyHash checks the
 * key, and prefix + last4 are what lists show.
 */
@Entity('api_key')
@Index(['organizationId', 'createdAt'])
export class ApiKey extends BaseEntity {
  /** What it's for, e.g. "Carrier tracking sync". */
  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  /** Branches are deactivated, not deleted; if one ever is, its keys go with it. */
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  /** The key's first characters, e.g. "stk_9f3a". */
  @Column({ length: 8 })
  prefix!: string;

  @Column({ name: 'last4', length: 4 })
  last4!: string;

  /** bcrypt hash of the key: the actual check. */
  @Column({ name: 'key_hash', length: 60 })
  keyHash!: string;

  /**
   * HMAC-SHA256 of the key with API_KEY_HMAC_SECRET, in hex. Deterministic,
   * unlike the bcrypt hash, so it finds the row in one indexed lookup.
   */
  @Column({ name: 'key_hmac', length: 64, unique: true })
  keyHmac!: string;

  /** The admin who created it. Null if that staff account is ever deleted. */
  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById!: string | null;

  @ManyToOne(() => InternalUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: InternalUser | null;

  /** Written at most once a minute (see ApiKeysService.touchLastUsed). */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  /** Set once; a revoked key is kept for the list but never accepted again. */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
