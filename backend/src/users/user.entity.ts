import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
}

@Entity('user')
export class User extends BaseEntity {
  @Column({ unique: true })
  email!: string;

  /** Null for OAuth-only accounts (see authProvider) — there's no password to check. */
  @Column({ type: 'varchar', nullable: true })
  password!: string | null;

  @Column()
  name!: string;

  @Column({ name: 'is_verified', default: false })
  isVerified!: boolean;

  @Column({
    name: 'auth_provider',
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.EMAIL,
  })
  authProvider!: AuthProvider;

  /**
   * Storage key for the current avatar object — the only avatar state we
   * persist. The URL served to clients is a signed GET generated fresh on
   * read (see FileStorageService.getAvatarUrl), never stored, since signed
   * URLs expire.
   */
  @Column({ name: 'avatar_key', type: 'varchar', nullable: true })
  avatarKey?: string | null;

  /**
   * Any refresh token whose row predates this timestamp is treated as
   * invalid, without needing to touch/delete every row — a cheap
   * "logout everywhere, including sessions I don't have a handle on"
   * primitive (security incident response, "log out all other devices").
   */
  @Column({ name: 'force_logout_after', type: 'timestamptz', nullable: true })
  forceLogoutAfter!: Date | null;

  /** Set false by self-deactivation (DELETE /users/profile) — blocks login, never a hard delete. */
  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName!: string | null;

  /** 'date' columns round-trip as "YYYY-MM-DD" strings, not Date objects — see PostgresDriver.prepareHydratedValue. */
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth!: string | null;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber!: string | null;
}
