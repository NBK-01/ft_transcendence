import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ConversationType {
  STAFF_DM = 'staff_dm',
  SUPPORT = 'support',
}

/**
 * participantA/participantB hold the two InternalUser ids in a canonical
 * (sorted) order for STAFF_DM rows — both null for SUPPORT rows, so they
 * never collide with each other. The unique pair constraint is what lets
 * ChatService recover from a race (two concurrent requests to open the same
 * DM) by catching the loser's insert instead of relying on a find-then-create
 * check that both requests could pass at once.
 */
@Entity('conversation')
@Unique(['participantAId', 'participantBId'])
@Unique(['customerId'])
export class Conversation extends BaseEntity {
  @Column({ type: 'enum', enum: ConversationType })
  type!: ConversationType;

  /** One standing SUPPORT conversation per customer — the unique constraint is the same race-safety mechanism as the DM pair. */
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string | null;

  @Column({ name: 'participant_a_id', type: 'uuid', nullable: true })
  participantAId?: string | null;

  @Column({ name: 'participant_b_id', type: 'uuid', nullable: true })
  participantBId?: string | null;
}
