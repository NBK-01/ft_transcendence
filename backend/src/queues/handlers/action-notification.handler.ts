import { I18nService } from 'nestjs-i18n';
import { AccountType } from '../../common/context/auth-context.types';
import {
  BranchPayload,
  NotificationPayloads,
  NotificationType,
  StaffAccountPayload,
} from '../../notifications/constants/notification.constants';
import {
  CreateNotificationInput,
  NotificationRecipient,
} from '../../notifications/notifications.service';
import { ActionLookupService } from '../../notifications/action-lookup.service';
import {
  ActionEventOf,
  ActionNotificationEvent,
  ActionType,
} from '../events/action-notification.event';
import { JobHandler } from '../interfaces/job-handler.interface';
import { notifyOnce } from './notify-once';

/** A group of recipients that share the wording `copy` (under notifications.<type> in i18n/en/notifications.json). */
interface Audience {
  copy: string;
  recipients: NotificationRecipient[];
}

/** What an action becomes: one payload for everyone, and who gets which wording. */
export interface Resolution<TPayload> {
  payload: TPayload;
  /** The copy's {placeholders}. */
  args: Record<string, string>;
  /** Most specific first: someone in two audiences gets the first one's wording, once. */
  audiences: Audience[];
}

/** Null when there's nothing left to say (e.g. a contact request declined before the job ran). */
type Resolver<T extends ActionType> = (
  event: ActionEventOf<T>,
  lookup: ActionLookupService,
) => Promise<Resolution<NotificationPayloads[T]> | null>;

const staff = (...ids: string[]): NotificationRecipient[] =>
  ids.map((id) => ({ id, accountType: AccountType.STAFF }));

// Shared by two action types each. Plain functions rather than Resolver<A | B>,
// which TypeScript wouldn't accept as a Resolver<A>.

async function branchChange(
  {
    data,
  }: ActionEventOf<
    NotificationType.BRANCH_UPDATED | NotificationType.BRANCH_DEACTIVATED
  >,
  lookup: ActionLookupService,
): Promise<Resolution<BranchPayload>> {
  return {
    payload: { organizationId: data.organizationId, name: data.name },
    args: { name: data.name },
    audiences: [
      { copy: 'staff', recipients: staff(...data.staffIds) },
      { copy: 'admins', recipients: await lookup.findAdmins() },
    ],
  };
}

function branchMembership({
  data,
}: ActionEventOf<
  NotificationType.BRANCH_STAFF_ADDED | NotificationType.BRANCH_STAFF_REMOVED
>): Promise<Resolution<BranchPayload>> {
  return Promise.resolve({
    payload: { organizationId: data.organizationId, name: data.name },
    args: { name: data.name },
    audiences: [{ copy: 'self', recipients: staff(data.internalUserId) }],
  });
}

async function toAdmins(
  {
    data,
  }: ActionEventOf<
    | NotificationType.STAFF_ACCOUNT_CREATED
    | NotificationType.STAFF_ACCOUNT_DEACTIVATED
  >,
  lookup: ActionLookupService,
): Promise<Resolution<StaffAccountPayload>> {
  return {
    payload: { internalUserId: data.internalUserId, name: data.name },
    args: { name: data.name },
    audiences: [{ copy: 'admins', recipients: await lookup.findAdmins() }],
  };
}

/**
 * Who hears about each action, and what they're told. Exhaustive: a new
 * action type doesn't compile until it has a resolver. The actor and
 * inactive accounts are dropped afterwards, for every action alike.
 */
export const RESOLVERS: { [T in ActionType]: Resolver<T> } = {
  [NotificationType.BRANCH_CREATED]: async ({ data }, lookup) => ({
    payload: { organizationId: data.organizationId, name: data.name },
    args: { name: data.name },
    audiences: [{ copy: 'admins', recipients: await lookup.findAdmins() }],
  }),
  [NotificationType.BRANCH_UPDATED]: branchChange,
  [NotificationType.BRANCH_DEACTIVATED]: branchChange,
  [NotificationType.BRANCH_STAFF_ADDED]: branchMembership,
  [NotificationType.BRANCH_STAFF_REMOVED]: branchMembership,
  [NotificationType.STAFF_ACCOUNT_CREATED]: toAdmins,
  [NotificationType.STAFF_ACCOUNT_UPDATED]: async ({ data }, lookup) => {
    const account = await lookup.findStaff(data.internalUserId);
    if (!account) {
      return null;
    }
    return {
      payload: {
        internalUserId: account.id,
        name: account.name,
        changed: data.changed,
        roleName: account.roleName,
        organizationId: account.organizationId,
        organizationName: account.organizationName,
      },
      args: { name: account.name },
      audiences: [
        { copy: 'self', recipients: staff(account.id) },
        { copy: 'admins', recipients: await lookup.findAdmins() },
      ],
    };
  },
  [NotificationType.STAFF_ACCOUNT_DEACTIVATED]: toAdmins,
  [NotificationType.CONTACT_REQUEST_RECEIVED]: async ({ data }, lookup) => {
    const contact = await lookup.findContact(data.contactId);
    return (
      contact && {
        payload: {
          contactId: data.contactId,
          internalUserId: contact.requester.id,
          name: contact.requester.name,
        },
        args: { name: contact.requester.name },
        audiences: [{ copy: 'self', recipients: staff(contact.addressee.id) }],
      }
    );
  },
  [NotificationType.CONTACT_REQUEST_ACCEPTED]: async ({ data }, lookup) => {
    const contact = await lookup.findContact(data.contactId);
    return (
      contact && {
        payload: {
          contactId: data.contactId,
          internalUserId: contact.addressee.id,
          name: contact.addressee.name,
        },
        args: { name: contact.addressee.name },
        audiences: [{ copy: 'self', recipients: staff(contact.requester.id) }],
      }
    );
  },
  [NotificationType.SUPPORT_CONVERSATION_STARTED]: async ({ data }, lookup) => {
    const customerName = await lookup.findCustomerName(data.customerId);
    if (customerName === null) {
      return null;
    }
    return {
      payload: { conversationId: data.conversationId, customerName },
      args: { customerName },
      audiences: [
        { copy: 'staff', recipients: await lookup.findSupportStaff() },
      ],
    };
  },
  [NotificationType.SHIPMENT_FILE_ADDED]: async ({ data }, lookup) => {
    const shipment = await lookup.findShipment(data.shipmentId);
    if (!shipment) {
      return null;
    }
    const { trackingId, clientId } = shipment;
    return {
      payload: { trackingId, kind: data.kind, fileName: data.fileName },
      args: { trackingId, fileName: data.fileName },
      audiences: [
        {
          copy: `customer.${data.kind}`,
          recipients: [{ id: clientId, accountType: AccountType.CUSTOMER }],
        },
      ],
    };
  },
  [NotificationType.PASSWORD_CHANGED]: ({ data }) =>
    Promise.resolve({
      payload: {},
      args: {},
      audiences: [{ copy: 'self', recipients: [data.account] }],
    }),
};

/** The one notice that also reaches the person who acted: if it wasn't them, they need to know. */
const NOTIFIES_ACTOR: ReadonlySet<ActionType> = new Set([
  NotificationType.PASSWORD_CHANGED,
]);

/** Every row for one occurrence starts with it, which is how onFinalFailure finds them. */
export function actionDedupeKeyPrefix(
  event: Pick<ActionNotificationEvent, 'type' | 'occurrence'>,
): string {
  return `action:${event.type}:${event.occurrence}:`;
}

const keyOf = (recipient: NotificationRecipient) =>
  `${recipient.accountType}:${recipient.id}`;

/**
 * The audiences as one list: each person once (in their first audience),
 * without the actor (unless the action notifies them), and staff only while
 * their account is active. Customer accounts can't be deactivated.
 */
async function recipientsOf(
  event: ActionNotificationEvent,
  audiences: Audience[],
  lookup: ActionLookupService,
): Promise<Array<{ recipient: NotificationRecipient; copy: string }>> {
  const actorKey = event.actor && keyOf(event.actor);
  const seen = new Set<string>();
  const picked: Array<{ recipient: NotificationRecipient; copy: string }> = [];
  for (const { copy, recipients } of audiences) {
    for (const recipient of recipients) {
      const key = keyOf(recipient);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      if (key !== actorKey || NOTIFIES_ACTOR.has(event.type)) {
        picked.push({ recipient, copy });
      }
    }
  }
  const isStaff = ({ recipient }: { recipient: NotificationRecipient }) =>
    recipient.accountType === AccountType.STAFF;
  const active = await lookup.activeStaffIds(
    picked.filter(isStaff).map(({ recipient }) => recipient.id),
  );
  return picked.filter(
    (entry) => !isStaff(entry) || active.has(entry.recipient.id),
  );
}

/** English copy from i18n/en/notifications.json. */
export function actionCopy(
  i18n: I18nService,
  type: ActionType,
  copy: string,
  args: Record<string, string>,
): { title: string; message: string } {
  const key = `notifications.${type}.${copy}`;
  const options = { lang: 'en', args };
  return {
    title: i18n.translate(`${key}.title`, options),
    message: i18n.translate(`${key}.message`, options),
  };
}

export const actionNotificationHandler: JobHandler<ActionNotificationEvent> = {
  async run(job, services) {
    const event = job.data;
    // TypeScript can't pair a union's members with the map's; the map's own type already does.
    const resolve = RESOLVERS[event.type] as Resolver<ActionType>;
    const resolution = await resolve(event, services.actionLookupService);
    if (!resolution) {
      return { recipients: 0, delivered: 0 };
    }

    const recipients = await recipientsOf(
      event,
      resolution.audiences,
      services.actionLookupService,
    );
    let delivered = 0;
    for (const { recipient, copy } of recipients) {
      const sent = await notifyOnce(services, {
        recipient,
        type: event.type,
        payload: resolution.payload,
        ...actionCopy(services.i18n, event.type, copy, resolution.args),
        dedupeKey: `${actionDedupeKeyPrefix(event)}${keyOf(recipient)}`,
      } as CreateNotificationInput);
      delivered += Number(sent);
    }
    return { recipients: recipients.length, delivered };
  },

  async onFinalFailure(job, services) {
    await services.notificationsService.markPendingFailed(
      actionDedupeKeyPrefix(job.data),
    );
  },
};
