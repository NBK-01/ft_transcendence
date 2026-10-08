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
}
