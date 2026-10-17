import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { AuthProvider, User } from '../../users/user.entity';

/**
 * Links a User to an external identity provider account. Kept separate from
 * User itself (rather than a bare `googleId` column) so provider-specific
 * profile data (picture, provider's own name) doesn't pollute User, and so
 * adding another provider later doesn't mean another column.
 */
@Entity('auth_provider_user')
@Unique(['provider', 'providerId'])
export class AuthProviderUser extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: AuthProvider })
  provider!: AuthProvider;

  /** The provider's own user id (e.g. Google's `sub`) — not our User.id. */
  @Column({ name: 'provider_id' })
  providerId!: string;

  @Column()
  email!: string;

  @Column()
  name!: string;

  @Column({ name: 'profile_picture', type: 'varchar', nullable: true })
  profilePicture?: string | null;
}
