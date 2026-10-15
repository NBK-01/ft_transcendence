import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

@Entity('user')
export class User extends BaseEntity {
  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column()
  name!: string;

  @Column({ name: 'is_verified', default: false })
  isVerified!: boolean;

  /**
   * Any refresh token whose row predates this timestamp is treated as
   * invalid, without needing to touch/delete every row — a cheap
   * "logout everywhere, including sessions I don't have a handle on"
   * primitive (security incident response, "log out all other devices").
   */
  @Column({ name: 'force_logout_after', type: 'timestamptz', nullable: true })
  forceLogoutAfter!: Date | null;
}
