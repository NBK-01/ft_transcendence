import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { AccountType } from '../../common/context/auth-context.types';
import { Conversation } from './conversation.entity';

@Entity('message')
export class Message extends BaseEntity {
  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  /** A User.id or InternalUser.id depending on senderType — polymorphic, no FK. */
  @Column({ name: 'sender_id', type: 'uuid' })
  senderId!: string;

  @Column({ name: 'sender_type', type: 'enum', enum: AccountType })
  senderType!: AccountType;

  @Column({ type: 'text' })
  content!: string;
}
