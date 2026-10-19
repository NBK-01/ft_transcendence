import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { InternalUser } from '../internal-users/internal-user.entity';

export enum ContactStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  BLOCKED = 'blocked',
}

@Entity('contact')
@Unique(['requesterId', 'addresseeId'])
export class Contact extends BaseEntity {
  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId!: string;

  @ManyToOne(() => InternalUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_id' })
  requester!: InternalUser;

  @Column({ name: 'addressee_id', type: 'uuid' })
  addresseeId!: string;

  @ManyToOne(() => InternalUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'addressee_id' })
  addressee!: InternalUser;

  @Column({ type: 'enum', enum: ContactStatus, default: ContactStatus.PENDING })
  status!: ContactStatus;
}
