import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  ObjectLiteral,
  RemoveEvent,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  UpdateEvent,
} from 'typeorm';
import { Organization } from '../../organizations/organization.entity';
import { InternalUser } from '../../internal-users/internal-user.entity';
import { Contact, ContactStatus } from '../../contacts/contact.entity';
import {
  Conversation,
  ConversationType,
} from '../../chat/entities/conversation.entity';
import { Message } from '../../chat/entities/message.entity';
import { ShipmentFile } from '../../shipments/entities/shipment-file.entity';
import { User } from '../../users/user.entity';
import { ATTACHMENT_KINDS } from '../../shipments/constants/shipment-state';
import {
  NotificationType,
  StaffChange,
} from '../../notifications/constants/notification.constants';
import { NotificationRecipient } from '../../notifications/notifications.service';
import { ActionLookupService } from '../../notifications/action-lookup.service';
import {
  ActionNotificationEvent,
  occurrenceOf,
} from '../events/action-notification.event';
import { ActionNotifier } from '../services/action-notifier.service';
import { AfterCommit } from './after-commit';

type Build = () => Promise<ActionNotificationEvent | null>;
type Actor = NotificationRecipient | null;

/** Messages from one sender in one conversation within it make one notice. */
const MESSAGE_WINDOW_MS = 10 * 60_000;

const contactParties = ({ id, requesterId, addresseeId }: Contact) => ({
  contactId: id,
  requesterId,
  addresseeId,
});

/**
 * The trigger for the actions TypeORM can describe on its own: rows created
 * with save()/insert(), rows changed with save(), which come with their old
 * values, and rows deleted with remove(). Who acted is read from the request
 * while it runs; the job is enqueued once the transaction commits
 * (AfterCommit).
 *  - customer signed up (UsersService.create/createOAuthUser)
 *  - branch created, updated, deactivated (OrganizationsService.create/update)
 *  - staff account created, updated, deactivated (InternalUsersService.create/update)
 *  - contact request sent, accepted, declined, withdrawn; contact blocked,
 *    removed (ContactsService)
 *  - support conversation or staff DM started, message sent (ChatService)
 *  - an attachment added to a shipment (AdminShipmentsService.uploadFile)
 */
@Injectable()
export class ActionSubscriber implements EntitySubscriberInterface {
  private readonly afterCommit = new AfterCommit('pendingActions');

  // No listenTo(): it watches several tables and tells them apart by event.metadata.target.
  constructor(
    dataSource: DataSource,
    private readonly notifier: ActionNotifier,
    private readonly lookup: ActionLookupService,
  ) {
    dataSource.subscribers.push(this);
  }

  afterInsert(event: InsertEvent<ObjectLiteral>): void {
    const build = this.inserted(
      event.metadata.target,
      event.entity,
      this.notifier.actor(),
    );
    this.schedule(event, build);
  }

  afterUpdate(event: UpdateEvent<ObjectLiteral>): void {
    // repository.update() comes with neither the row nor its old values:
    // those writes emit ActionSignals instead (ActionSignalsListener).
    if (!event.entity || !event.databaseEntity) {
      return;
    }
    const build = this.updated(
      event.metadata.target,
      event.databaseEntity,
      event.entity,
      this.notifier.actor(),
    );
    this.schedule(event, build);
  }

  afterRemove(event: RemoveEvent<ObjectLiteral>): void {
    // After a remove TypeORM clears the entity's id: it's in event.entityId.
    const removed = event.databaseEntity ?? event.entity;
    if (event.metadata.target !== Contact || !removed || !event.entityId) {
      return;
    }
    const build = this.contactRemoved(
      { ...(removed as Contact), id: String(event.entityId) },
      this.notifier.actor(),
    );
    this.schedule(event, build);
  }

  afterTransactionCommit(event: TransactionCommitEvent): void {
    this.afterCommit.committed(event.queryRunner);
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.afterCommit.rolledBack(event.queryRunner);
  }

  private schedule(
    event:
      | InsertEvent<ObjectLiteral>
      | UpdateEvent<ObjectLiteral>
      | RemoveEvent<ObjectLiteral>,
    build: Build | null,
  ): void {
    if (build) {
      this.afterCommit.schedule(event.queryRunner, () =>
        this.notifier.notify(build),
      );
    }
  }

  private inserted(
    target: unknown,
    entity: ObjectLiteral,
    actor: Actor,
  ): Build | null {
    if (target === User) {
      const { id, name } = entity as User;
      return async () => ({
        type: NotificationType.CUSTOMER_REGISTERED,
        occurrence: id,
        actor,
        data: { customerId: id, name },
      });
    }
    if (target === Organization) {
      const { id, name } = entity as Organization;
      return async () => ({
        type: NotificationType.BRANCH_CREATED,
        occurrence: id,
        actor,
        data: { organizationId: id, name },
      });
    }
    if (target === InternalUser) {
      const { id, name } = entity as InternalUser;
      return async () => ({
        type: NotificationType.STAFF_ACCOUNT_CREATED,
        occurrence: id,
        actor,
        data: { internalUserId: id, name },
      });
    }
    if (target === Contact) {
      const { id } = entity as Contact;
      return async () => ({
        type: NotificationType.CONTACT_REQUEST_RECEIVED,
        occurrence: id,
        actor,
        data: { contactId: id },
      });
    }
    if (target === Conversation) {
      return this.conversationStarted(entity as Conversation, actor);
    }
    if (target === Message) {
      return this.messageSent(entity as Message);
    }
    if (target === ShipmentFile) {
      return this.fileAdded(entity as ShipmentFile, actor);
    }
    return null;
  }

  private updated(
    target: unknown,
    before: ObjectLiteral,
    after: ObjectLiteral,
    actor: Actor,
  ): Build | null {
    if (target === Organization) {
      return this.branchChanged(
        before as Organization,
        after as Organization,
        actor,
      );
    }
    if (target === InternalUser) {
      return this.staffChanged(
        before as InternalUser,
        after as InternalUser,
        actor,
      );
    }
    if (target === Contact) {
      return this.contactChanged(before as Contact, after as Contact, actor);
    }
    return null;
  }

  /** A customer's SUPPORT conversation, or a staff DM. */
  private conversationStarted(conversation: Conversation, actor: Actor) {
    const { id, type, customerId, participantAId, participantBId } =
      conversation;
    if (type === ConversationType.SUPPORT && customerId) {
      return async (): Promise<ActionNotificationEvent> => ({
        type: NotificationType.SUPPORT_CONVERSATION_STARTED,
        occurrence: id,
        actor,
        data: { conversationId: id, customerId },
      });
    }
    if (
      type === ConversationType.STAFF_DM &&
      participantAId &&
      participantBId
    ) {
      return async (): Promise<ActionNotificationEvent> => ({
        type: NotificationType.CONVERSATION_STARTED,
        occurrence: id,
        actor,
        data: {
          conversationId: id,
          participantIds: [participantAId, participantBId],
        },
      });
    }
    return null;
  }

  /**
   * One notice per sender, conversation and 10 minutes: the job id and the
   * dedupe keys repeat within the window, so later messages in it add none.
   * The sender comes from the row (a socket message has no request context).
   */
  private messageSent(message: Message) {
    const { conversationId, senderId, senderType } = message;
    const sentAt = message.createdAt ?? new Date();
    const window = Math.floor(sentAt.getTime() / MESSAGE_WINDOW_MS);
    return async (): Promise<ActionNotificationEvent> => ({
      type: NotificationType.MESSAGE_RECEIVED,
      occurrence: `${conversationId}-${senderId}-${window}`,
      actor: null,
      data: {
        conversationId,
        sender: { id: senderId, accountType: senderType },
      },
    });
  }

  /** Only the Files tab's kinds: request and offer photos are inserted here too. */
  private fileAdded(file: ShipmentFile, actor: Actor) {
    const { id, shipmentId, kind, name } = file;
    const attachment = ATTACHMENT_KINDS.find((candidate) => candidate === kind);
    if (!attachment) {
      return null;
    }
    return async (): Promise<ActionNotificationEvent> => ({
      type: NotificationType.SHIPMENT_FILE_ADDED,
      occurrence: id,
      actor,
      data: { shipmentId, kind: attachment, fileName: name },
    });
  }

  /** Deactivated, or details changed / reactivated. The branch's staff are taken after the commit. */
  private branchChanged(
    before: Organization,
    after: Organization,
    actor: Actor,
  ) {
    const deactivated = before.isActive && !after.isActive;
    const updated =
      before.name !== after.name ||
      before.description !== after.description ||
      before.contactEmail !== after.contactEmail ||
      (!before.isActive && after.isActive);
    if (!deactivated && !updated) {
      return null;
    }
    const occurrence = occurrenceOf(after.id, after.updatedAt);
    return async (): Promise<ActionNotificationEvent> => {
      const data = {
        organizationId: after.id,
        name: after.name,
        staffIds: await this.lookup.findBranchStaffIds(after.id),
      };
      return deactivated
        ? { type: NotificationType.BRANCH_DEACTIVATED, occurrence, actor, data }
        : { type: NotificationType.BRANCH_UPDATED, occurrence, actor, data };
    };
  }

  /** Deactivated, or role, branch or name changed / reactivated. Anything else (e.g. a sign-out everywhere) says nothing. */
  private staffChanged(
    before: InternalUser,
    after: InternalUser,
    actor: Actor,
  ) {
    const occurrence = occurrenceOf(after.id, after.updatedAt);
    const { id: internalUserId, name } = after;
    if (before.isActive && !after.isActive) {
      return async (): Promise<ActionNotificationEvent> => ({
        type: NotificationType.STAFF_ACCOUNT_DEACTIVATED,
        occurrence,
        actor,
        data: { internalUserId, name },
      });
    }
    const changed: StaffChange[] = [];
    if (before.roleId !== after.roleId) changed.push('role');
    if ((before.organizationId ?? null) !== (after.organizationId ?? null)) {
      changed.push('branch');
    }
    if (before.name !== after.name) changed.push('name');
    if (!before.isActive && after.isActive) changed.push('reactivated');
    if (!changed.length) {
      return null;
    }
    return async (): Promise<ActionNotificationEvent> => ({
      type: NotificationType.STAFF_ACCOUNT_UPDATED,
      occurrence,
      actor,
      data: { internalUserId, name, changed },
    });
  }

  /** pending → accepted, or anything → blocked. Each happens at most once to a contact. */
  private contactChanged(before: Contact, after: Contact, actor: Actor) {
    if (
      before.status === ContactStatus.PENDING &&
      after.status === ContactStatus.ACCEPTED
    ) {
      return async (): Promise<ActionNotificationEvent> => ({
        type: NotificationType.CONTACT_REQUEST_ACCEPTED,
        occurrence: `${after.id}-accepted`,
        actor,
        data: { contactId: after.id },
      });
    }
    if (
      before.status !== ContactStatus.BLOCKED &&
      after.status === ContactStatus.BLOCKED
    ) {
      return async (): Promise<ActionNotificationEvent> => ({
        type: NotificationType.CONTACT_BLOCKED,
        occurrence: `${after.id}-blocked`,
        actor,
        data: contactParties(after),
      });
    }
    return null;
  }

  /**
   * A pending request removed by the addressee is declined, by the requester
   * withdrawn; an accepted or blocked contact removed is removed.
   */
  private contactRemoved(contact: Contact, actor: Actor) {
    const data = contactParties(contact);
    const occurrence = `${contact.id}-removed`;
    if (contact.status !== ContactStatus.PENDING) {
      return async (): Promise<ActionNotificationEvent> => ({
        type: NotificationType.CONTACT_REMOVED,
        occurrence,
        actor,
        data,
      });
    }
    const type =
      actor?.id === contact.requesterId
        ? NotificationType.CONTACT_REQUEST_CANCELLED
        : NotificationType.CONTACT_REQUEST_DECLINED;
    return async (): Promise<ActionNotificationEvent> => ({
      type,
      occurrence,
      actor,
      data,
    });
  }
}
