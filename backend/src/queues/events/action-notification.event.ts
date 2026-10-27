import { AttachmentKind } from '../../shipments/constants/shipment-state';
import {
  ApiKeyPayload,
  NotificationType,
  StaffChange,
} from '../../notifications/constants/notification.constants';
import { NotificationRecipient } from '../../notifications/notifications.service';

/** Every notification type but SHIPMENT_UPDATE, which has its own job. */
export type ActionType = Exclude<
  NotificationType,
  NotificationType.SHIPMENT_UPDATE
>;

/**
 * What each action's job carries. Names and a branch's staff are taken when
 * the action happens (the job runs later, after more changes may have been
 * made); everything else is read when the job runs.
 */
export interface ActionDataMap {
  [NotificationType.BRANCH_CREATED]: { organizationId: string; name: string };
  [NotificationType.BRANCH_UPDATED]: {
    organizationId: string;
    name: string;
    staffIds: string[];
  };
  [NotificationType.BRANCH_DEACTIVATED]: {
    organizationId: string;
    name: string;
    staffIds: string[];
  };
  [NotificationType.BRANCH_STAFF_ADDED]: {
    organizationId: string;
    name: string;
    internalUserId: string;
  };
  [NotificationType.BRANCH_STAFF_REMOVED]: {
    organizationId: string;
    name: string;
    internalUserId: string;
  };
  [NotificationType.STAFF_ACCOUNT_CREATED]: {
    internalUserId: string;
    name: string;
  };
  [NotificationType.STAFF_ACCOUNT_UPDATED]: {
    internalUserId: string;
    name: string;
    changed: StaffChange[];
  };
  [NotificationType.STAFF_ACCOUNT_DEACTIVATED]: {
    internalUserId: string;
    name: string;
  };
  [NotificationType.CONTACT_REQUEST_RECEIVED]: { contactId: string };
  [NotificationType.CONTACT_REQUEST_ACCEPTED]: { contactId: string };
  [NotificationType.SUPPORT_CONVERSATION_STARTED]: {
    conversationId: string;
    customerId: string;
  };
  [NotificationType.SHIPMENT_FILE_ADDED]: {
    shipmentId: string;
    kind: AttachmentKind;
    fileName: string;
  };
  [NotificationType.PASSWORD_CHANGED]: { account: NotificationRecipient };
  [NotificationType.API_KEY_CREATED]: ApiKeyPayload;
  [NotificationType.API_KEY_REVOKED]: ApiKeyPayload;
}

/**
 * Data of an ACTION_NOTIFICATION job: something was created, changed or
 * deleted, and the people it affects hear about it.
 */
export type ActionNotificationEvent = {
  [T in ActionType]: {
    type: T;
    /**
     * This occurrence of the action: the entity's id for a creation, its id
     * and updatedAt (ms) for a change that can repeat. Part of the job id and
     * of every dedupe key. No ':' (BullMQ refuses it in job ids).
     */
    occurrence: string;
    /** Who did it: they get a record of it rather than the news; null outside a request (a seed, a job). */
    actor: NotificationRecipient | null;
    data: ActionDataMap[T];
  };
}[ActionType];

/** The event for one action type. */
export type ActionEventOf<T extends ActionType> = Extract<
  ActionNotificationEvent,
  { type: T }
>;

/** An occurrence for a change that can repeat: the row's id and its updatedAt, in ms. */
export function occurrenceOf(id: string, updatedAt: Date | string): string {
  return `${id}-${new Date(updatedAt).getTime()}`;
}
