import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { AccountType } from '../../common/context/auth-context.types';
import { Conversation } from './conversation.entity';

/**
 * A personal read-cursor, never an authorization gate — access to a SUPPORT
 * conversation stays permission-based (chat:support:access), checked fresh
 * every time. A staff member's row on a SUPPORT conversation is created the
 * first time THEY specifically open it, not when the conversation itself
 * is created.
 */
@Entity('conversation_participant')
@Unique(['conversationId', 'participantId', 'participantType'])
export class ConversationParticipant extends BaseEntity {
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  /** A User.id or InternalUser.id depending on participantType — polymorphic, no FK. */
  @Column({ name: 'participant_id', type: 'uuid' })
  participantId!: string;

  @Column({ name: 'participant_type', type: 'enum', enum: AccountType })
  participantType!: AccountType;

  @Column({ name: 'last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt?: Date | null;
}
