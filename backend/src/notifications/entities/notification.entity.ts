import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { AccountType } from '../../common/context/auth-context.types';
import {
  NotificationPayload,
  NotificationStatus,
  NotificationType,
} from '../constants/notification.constants';

/**
 * One notification for one person (customer or staff). Rows are only ever
 * read through the owner's (userId, accountType); dismissing one is soft
 * (dismissedAt), so it leaves the list and the counts but stays in the table.
 */
@Entity('notification')
@Index(['userId', 'createdAt'])
@Index(['userId', 'status'])
export class Notification extends BaseEntity {
  /** A User.id or InternalUser.id depending on accountType — polymorphic, no FK (same as chat). */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'account_type', type: 'enum', enum: AccountType })
  accountType!: AccountType;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  /** English copy, rendered when the row is created. */
  @Column()
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb' })
  payload!: NotificationPayload;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ name: 'dismissed_at', type: 'timestamptz', nullable: true })
  dismissedAt!: Date | null;

  /**
   * Identifies the source and the recipient, e.g. "shipment-event:<eventId>:<userId>".
   * Unique, so the same source can never create two rows for one person,
   * even when a job runs twice.
   */
  @Column({ name: 'dedupe_key', unique: true })
  dedupeKey!: string;
}
