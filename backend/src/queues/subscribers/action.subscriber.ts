import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  ObjectLiteral,
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
import { ShipmentFile } from '../../shipments/entities/shipment-file.entity';
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

/**
 * The trigger for the actions TypeORM can describe on its own: rows created
 * with save()/insert(), and rows changed with save(), which come with their
 * old values. Who acted is read from the request while it runs; the job is
 * enqueued once the transaction commits (AfterCommit).
 *  - branch created, updated, deactivated (OrganizationsService.create/update)
 *  - staff account created, updated, deactivated (InternalUsersService.create/update)
 *  - contact request sent, accepted (ContactsService.sendRequest/acceptRequest)
 *  - support conversation started (ChatService, a new SUPPORT conversation)
 *  - an attachment added to a shipment (AdminShipmentsService.uploadFile)
 * Declined, blocked and removed contacts notify nobody, by design.
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

  afterTransactionCommit(event: TransactionCommitEvent): void {
    this.afterCommit.committed(event.queryRunner);
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.afterCommit.rolledBack(event.queryRunner);
  }

  private schedule(
    event: InsertEvent<ObjectLiteral> | UpdateEvent<ObjectLiteral>,
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
      return this.supportStarted(entity as Conversation, actor);
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
      return this.contactAccepted(before as Contact, after as Contact, actor);
    }
    return null;
  }

  /** Only a customer's SUPPORT conversation: staff DMs are inserted here too. */
  private supportStarted(conversation: Conversation, actor: Actor) {
    const { id, type, customerId } = conversation;
    if (type !== ConversationType.SUPPORT || !customerId) {
      return null;
    }
    return async (): Promise<ActionNotificationEvent> => ({
      type: NotificationType.SUPPORT_CONVERSATION_STARTED,
      occurrence: id,
      actor,
      data: { conversationId: id, customerId },
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

  /** pending → accepted. Blocking also saves the contact, and notifies nobody. */
  private contactAccepted(before: Contact, after: Contact, actor: Actor) {
    if (
      before.status !== ContactStatus.PENDING ||
      after.status !== ContactStatus.ACCEPTED
    ) {
      return null;
    }
    return async (): Promise<ActionNotificationEvent> => ({
      type: NotificationType.CONTACT_REQUEST_ACCEPTED,
      // A contact is accepted at most once.
      occurrence: `${after.id}-accepted`,
      actor,
      data: { contactId: after.id },
    });
  }
}
