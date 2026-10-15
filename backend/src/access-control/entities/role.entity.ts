import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('role')
export class Role extends BaseEntity {
  @Column({ unique: true })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string | null;
}
