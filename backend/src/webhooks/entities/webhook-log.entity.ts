import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import {
  WebhookLogStatus,
  WebhookProvider,
} from '../constants/webhook.constants';

/**
 * Every webhook delivery we accepted (signature checked), for idempotency
 * and as an audit trail. An event's first delivery holds its idempotency
 * key ("<provider>:<eventId>", unique) and its processing state; each
 * redelivery of the same event gets a DUPLICATE row pointing at it.
 */
@Entity('webhook_log')
@Index(['provider', 'createdAt'])
export class WebhookLog extends BaseEntity {
  @Column({ type: 'enum', enum: WebhookProvider })
  provider!: WebhookProvider;

  /** E.g. "tracking.updated". */
  @Column({ name: 'event_type' })
  eventType!: string;

  /** What it's about, e.g. a tracking ID. */
  @Column({ name: 'resource_id', type: 'varchar', nullable: true })
  resourceId!: string | null;

  /** Set on an event's first delivery only (null on its DUPLICATE rows), so it's unique per event. */
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    nullable: true,
    unique: true,
  })
  idempotencyKey!: string | null;

  /** On a DUPLICATE row: the first delivery it repeats. */
  @Column({ name: 'duplicate_of_id', type: 'uuid', nullable: true })
  duplicateOfId!: string | null;

  @ManyToOne(() => WebhookLog, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'duplicate_of_id' })
  duplicateOf?: WebhookLog | null;

  /** The body as the provider sent it. */
  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: WebhookLogStatus,
    default: WebhookLogStatus.RECEIVED,
  })
  status!: WebhookLogStatus;

  /** How many times a job started processing it. */
  @Column({ default: 0 })
  attempts!: number;

  /** Why it failed (or why the last attempt did). */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;
}
