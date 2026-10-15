import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/** name follows 'resource:action[:scope]', e.g. 'organizations:manage', 'shipments:read:own'. */
@Entity('permission')
export class Permission extends BaseEntity {
  @Column({ unique: true })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string | null;
}
