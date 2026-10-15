import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Role } from '../access-control/entities/role.entity';
import { Organization } from '../organizations/organization.entity';

/**
 * Staff — structurally separate from the customer-facing `User` table.
 * Customers never have a role; staff always belong to this table instead,
 * with a role and (optionally) a branch. See jwt-payload.interface.ts's
 * AccountType for how a request is told which table a token belongs to.
 */
@Entity('internal_user')
export class InternalUser extends BaseEntity {
  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column()
  name!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId!: string | null;

  @ManyToOne(() => Role, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'role_id' })
  role?: Role;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @ManyToOne(() => Organization, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @Column({ name: 'force_logout_after', type: 'timestamptz', nullable: true })
  forceLogoutAfter!: Date | null;
}
