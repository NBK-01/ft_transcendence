import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

@Entity('organization')
export class Organization extends BaseEntity {
  @Column({ unique: true })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string | null;

  @Column({ name: 'contact_email', type: 'varchar', nullable: true })
  contactEmail?: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
