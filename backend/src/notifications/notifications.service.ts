import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Like, Not, Repository } from 'typeorm';
import { RequestUser } from '../common/context/auth-context.types';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import {
  NotificationPayloads,
  NotificationStatus,
  NotificationType,
} from './constants/notification.constants';
import { Notification } from './entities/notification.entity';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationCountDto, NotificationDto } from './dto/notification.dto';
import { NotificationFactory } from './factories/notification.factory';
import { NotificationNotFoundException } from './exceptions';

/** Who a notification is for: the same pair the JWT carries and the socket room is named after. */
export type NotificationRecipient = Pick<RequestUser, 'id' | 'accountType'>;

/** One notification for one person. `payload` must match `type` (see NotificationPayloads). */
export type CreateNotificationInput = {
  [T in NotificationType]: {
    recipient: NotificationRecipient;
    type: T;
    payload: NotificationPayloads[T];
    title: string;
    message: string;
    /** Same source + same person = same key, e.g. "shipment-event:<eventId>:<userId>". */
    dedupeKey: string;
  };
}[NotificationType];

export interface CreateNotificationResult {
  notification: Notification;
  /** False when a row with this dedupeKey already existed, so nothing was inserted. */
  created: boolean;
}

/**
 * The signed-in account's feed (list, unread count, read, dismiss), plus the
 * write side the queue handlers use: create once per dedupe key, then record
 * whether delivery worked.
 *
 * Feed methods only ever see the caller's own rows that aren't dismissed —
 * someone else's id is a 404, not a 403.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /* ---------------------------------------------------------------------
   * Feed (the caller's own notifications)
   * ------------------------------------------------------------------- */

  async list(
    recipient: NotificationRecipient,
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedResponseDto<NotificationDto>> {
    const where = this.visibleTo(recipient);
    if (query.unreadOnly) {
      where.status = Not(NotificationStatus.READ);
    }
    if (query.type) {
      where.type = query.type;
    }
    const [rows, total] = await this.notificationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return PaginatedResponseDto.create(
      NotificationFactory.toDtoArray(rows),
      total,
      query.page,
      query.limit,
    );
  }

  async unreadCount(
    recipient: NotificationRecipient,
  ): Promise<NotificationCountDto> {
    const count = await this.notificationRepository.count({
      where: {
        ...this.visibleTo(recipient),
        status: Not(NotificationStatus.READ),
      },
    });
    return { count };
  }

  /** Works from any status. Idempotent: an already-read notification keeps its first readAt. */
  async markRead(
    recipient: NotificationRecipient,
    id: string,
  ): Promise<NotificationDto> {
    const notification = await this.findVisible(recipient, id);
    if (notification.status !== NotificationStatus.READ) {
      const readAt = new Date();
      await this.notificationRepository.update(
        { id, status: Not(NotificationStatus.READ) },
        { status: NotificationStatus.READ, readAt },
      );
      notification.status = NotificationStatus.READ;
      notification.readAt = readAt;
    }
    return NotificationFactory.toDto(notification);
  }

  /** Returns how many were marked. */
  async markAllRead(
    recipient: NotificationRecipient,
  ): Promise<NotificationCountDto> {
    const result = await this.notificationRepository.update(
      { ...this.visibleTo(recipient), status: Not(NotificationStatus.READ) },
      { status: NotificationStatus.READ, readAt: new Date() },
    );
    return { count: result.affected ?? 0 };
  }

  /** Soft: the row stays in the table but leaves the list and the counts. A second dismiss is a 404. */
  async dismiss(recipient: NotificationRecipient, id: string): Promise<void> {
    const result = await this.notificationRepository.update(
      { ...this.visibleTo(recipient), id },
      { dismissedAt: new Date() },
    );
    if (!result.affected) {
      throw new NotificationNotFoundException(id);
    }
  }

  /* ---------------------------------------------------------------------
   * Write side (queue handlers)
   * ------------------------------------------------------------------- */

  /**
   * Inserts the row unless its dedupeKey is taken (ON CONFLICT DO NOTHING),
   * then returns whichever row holds the key. A retried job gets the row its
   * first attempt created, so it can still deliver it while it's PENDING.
   */
  async createOnce(
    input: CreateNotificationInput,
  ): Promise<CreateNotificationResult> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .insert()
      .into(Notification)
      .values({
        userId: input.recipient.id,
        accountType: input.recipient.accountType,
        type: input.type,
        title: input.title,
        message: input.message,
        payload: input.payload,
        status: NotificationStatus.PENDING,
        dedupeKey: input.dedupeKey,
      })
      .orIgnore()
      .returning(['id'])
      .execute();
    const notification = await this.notificationRepository.findOneByOrFail({
      dedupeKey: input.dedupeKey,
    });
    // A skipped insert returns no row.
    return { notification, created: (result.raw as unknown[]).length > 0 };
  }

  /** Reached the user's live channel. Never touches a READ row (it was read first). */
  async markSent(id: string): Promise<boolean> {
    const result = await this.notificationRepository.update(
      {
        id,
        status: In([NotificationStatus.PENDING, NotificationStatus.FAILED]),
      },
      { status: NotificationStatus.SENT, sentAt: new Date() },
    );
    return Boolean(result.affected);
  }

  /** Delivery gave up for good (the job's last attempt). Only a PENDING row can fail. */
  async markFailed(id: string): Promise<boolean> {
    const result = await this.notificationRepository.update(
      { id, status: NotificationStatus.PENDING },
      { status: NotificationStatus.FAILED },
    );
    return Boolean(result.affected);
  }

  /**
   * For a job that gave up: every row it created that was never delivered
   * becomes FAILED. A job's rows share a dedupe key prefix, e.g.
   * "shipment-event:<eventId>:". Returns how many were marked.
   */
  async markPendingFailed(dedupeKeyPrefix: string): Promise<number> {
    const result = await this.notificationRepository.update(
      {
        dedupeKey: Like(`${dedupeKeyPrefix.replace(/[\\%_]/g, '\\$&')}%`),
        status: NotificationStatus.PENDING,
      },
      { status: NotificationStatus.FAILED },
    );
    return result.affected ?? 0;
  }

  /* ---------------------------------------------------------------------
   * Internals
   * ------------------------------------------------------------------- */

  /** The caller's rows that are still in their feed. A fresh object each call, so callers can add to it. */
  private visibleTo(
    recipient: NotificationRecipient,
  ): FindOptionsWhere<Notification> {
    return {
      userId: recipient.id,
      accountType: recipient.accountType,
      dismissedAt: IsNull(),
    };
  }

  private async findVisible(
    recipient: NotificationRecipient,
    id: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { ...this.visibleTo(recipient), id },
    });
    if (!notification) {
      throw new NotificationNotFoundException(id);
    }
    return notification;
  }
}
