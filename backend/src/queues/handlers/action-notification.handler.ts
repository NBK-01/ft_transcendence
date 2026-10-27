import { I18nService } from 'nestjs-i18n';
import { AccountType } from '../../common/context/auth-context.types';
import {
  ApiKeyPayload,
  BranchPayload,
  ContactPayload,
  MessagePayload,
  NotificationPayloads,
  NotificationType,
  StaffAccountPayload,
} from '../../notifications/constants/notification.constants';
import {
  CreateNotificationInput,
  NotificationRecipient,
} from '../../notifications/notifications.service';
import { ActionLookupService } from '../../notifications/action-lookup.service';
import { ConversationType } from '../../chat/entities/conversation.entity';
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
  /**
   * The payload and placeholders for the person who acted, when "the other
   * person" is someone else for them (a contact request: the one they asked).
   */
  forActor?: { payload: TPayload; args: Record<string, string> };
}

/** Null when there's nothing left to say (e.g. a contact request declined before the job ran). */
type Resolver<T extends ActionType> = (
  event: ActionEventOf<T>,
  lookup: ActionLookupService,
) => Promise<Resolution<NotificationPayloads[T]> | null>;

const staff = (...ids: string[]): NotificationRecipient[] =>
  ids.map((id) => ({ id, accountType: AccountType.STAFF }));

const customer = (id: string): NotificationRecipient => ({
  id,
  accountType: AccountType.CUSTOMER,
});

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

async function branchMembership(
  {
    data,
  }: ActionEventOf<
    NotificationType.BRANCH_STAFF_ADDED | NotificationType.BRANCH_STAFF_REMOVED
  >,
  lookup: ActionLookupService,
): Promise<Resolution<BranchPayload> | null> {
  const member = await lookup.findStaff(data.internalUserId);
  if (!member) {
    return null;
  }
  return {
    payload: {
      organizationId: data.organizationId,
      name: data.name,
      staffName: member.name,
    },
    args: { name: data.name, staffName: member.name },
    audiences: [{ copy: 'self', recipients: staff(member.id) }],
  };
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

/** A contact notice is about the other person: `other` for its reader. */
function aboutContact(
  contactId: string,
  other: { id: string; name: string },
): { payload: ContactPayload; args: Record<string, string> } {
  return {
    payload: { contactId, internalUserId: other.id, name: other.name },
    args: { name: other.name },
  };
}

/**
 * A contact declined, withdrawn, removed or blocked: only a record for
 * whoever did it, about the other person. Nobody else is told.
 */
async function contactRecord(
  {
    data,
    actor,
  }: ActionEventOf<
    | NotificationType.CONTACT_REQUEST_DECLINED
    | NotificationType.CONTACT_REQUEST_CANCELLED
    | NotificationType.CONTACT_REMOVED
    | NotificationType.CONTACT_BLOCKED
  >,
  lookup: ActionLookupService,
): Promise<Resolution<ContactPayload> | null> {
  if (!actor) {
    return null;
  }
  const otherId =
    actor.id === data.requesterId ? data.addresseeId : data.requesterId;
  const other = await lookup.findStaff(otherId);
  return other && { ...aboutContact(data.contactId, other), audiences: [] };
}

/** New messages: to the other participant, or in a support conversation, the other side. Never the sender. */
async function messageReceived(
  { data }: ActionEventOf<NotificationType.MESSAGE_RECEIVED>,
  lookup: ActionLookupService,
): Promise<Resolution<MessagePayload> | null> {
  const [conversation, senderName] = await Promise.all([
    lookup.findConversation(data.conversationId),
    lookup.findName(data.sender),
  ]);
  if (!conversation || senderName === null) {
    return null;
  }
  const resolution = (audience: Audience): Resolution<MessagePayload> => ({
    payload: {
      conversationId: conversation.id,
      conversationType: conversation.type,
      senderName,
    },
    args: { senderName },
    audiences: [audience],
  });
  if (conversation.type === ConversationType.STAFF_DM) {
    const otherId = [conversation.participantAId, conversation.participantBId]
      .filter((id): id is string => Boolean(id))
      .find((id) => id !== data.sender.id);
    return otherId
      ? resolution({ copy: 'self', recipients: staff(otherId) })
      : null;
  }
  if (data.sender.accountType === AccountType.CUSTOMER) {
    return resolution({
      copy: 'support',
      recipients: await lookup.findSupportStaff(),
    });
  }
  return conversation.customerId
    ? resolution({
        copy: 'self',
        recipients: [customer(conversation.customerId)],
      })
    : null;
}

async function apiKeyToAdmins(
  {
    data,
  }: ActionEventOf<
    NotificationType.API_KEY_CREATED | NotificationType.API_KEY_REVOKED
  >,
  lookup: ActionLookupService,
): Promise<Resolution<ApiKeyPayload>> {
  return {
    payload: data,
    args: { name: data.name, branch: data.branchName },
    audiences: [{ copy: 'admins', recipients: await lookup.findAdmins() }],
  };
}

/**
 * Who hears about each action, and what they're told. Exhaustive: a new
 * action type doesn't compile until it has a resolver. The actor's own
 * record, and leaving out inactive accounts, come afterwards, for every
 * action alike (recipientsOf).
 */
export const RESOLVERS: { [T in ActionType]: Resolver<T> } = {
  [NotificationType.BRANCH_CREATED]: async ({ data }, lookup) => ({
    payload: { organizationId: data.organizationId, name: data.name },
    args: { name: data.name },
    audiences: [{ copy: 'admins', recipients: await lookup.findAdmins() }],
  }),
  [NotificationType.BRANCH_UPDATED]: branchChange,
  [NotificationType.BRANCH_DEACTIVATED]: branchChange,
  // An empty branch (OrganizationsService.remove): nobody but the admins to tell.
  [NotificationType.BRANCH_DELETED]: async ({ data }, lookup) => ({
    payload: { organizationId: data.organizationId, name: data.name },
    args: { name: data.name },
    audiences: [{ copy: 'admins', recipients: await lookup.findAdmins() }],
  }),
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
        ...aboutContact(data.contactId, contact.requester),
        audiences: [{ copy: 'self', recipients: staff(contact.addressee.id) }],
        forActor: aboutContact(data.contactId, contact.addressee),
      }
    );
  },
  [NotificationType.CONTACT_REQUEST_ACCEPTED]: async ({ data }, lookup) => {
    const contact = await lookup.findContact(data.contactId);
    return (
      contact && {
        ...aboutContact(data.contactId, contact.addressee),
        audiences: [{ copy: 'self', recipients: staff(contact.requester.id) }],
        forActor: aboutContact(data.contactId, contact.requester),
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
  [NotificationType.API_KEY_CREATED]: apiKeyToAdmins,
  [NotificationType.API_KEY_REVOKED]: apiKeyToAdmins,
  [NotificationType.CUSTOMER_REGISTERED]: async ({ data }, lookup) => ({
    payload: { customerId: data.customerId, name: data.name },
    args: { name: data.name },
    audiences: [
      { copy: 'self', recipients: [customer(data.customerId)] },
      { copy: 'admins', recipients: await lookup.findAdmins() },
    ],
  }),
  [NotificationType.PROFILE_UPDATED]: ({ data }) =>
    Promise.resolve({
      payload: { change: data.change },
      args: {},
      audiences: [{ copy: 'self', recipients: [data.account] }],
    }),
  [NotificationType.CUSTOMER_ACCOUNT_DEACTIVATED]: async ({ data }, lookup) => {
    const name = await lookup.findCustomerName(data.customerId);
    if (name === null) {
      return null;
    }
    return {
      payload: { customerId: data.customerId, name },
      args: { name },
      audiences: [{ copy: 'admins', recipients: await lookup.findAdmins() }],
    };
  },
  [NotificationType.SESSIONS_REVOKED]: ({ data }) =>
    Promise.resolve({
      payload: {},
      args: {},
      audiences: [{ copy: 'self', recipients: [data.account] }],
    }),
  [NotificationType.CONTACT_REQUEST_DECLINED]: contactRecord,
  [NotificationType.CONTACT_REQUEST_CANCELLED]: contactRecord,
  [NotificationType.CONTACT_REMOVED]: contactRecord,
  [NotificationType.CONTACT_BLOCKED]: contactRecord,
  [NotificationType.CONVERSATION_STARTED]: async ({ data, actor }, lookup) => {
    const otherId = data.participantIds.find((id) => id !== actor?.id);
    if (!actor || !otherId) {
      return null;
    }
    const [opener, other] = await Promise.all([
      lookup.findStaff(actor.id),
      lookup.findStaff(otherId),
    ]);
    if (!opener || !other) {
      return null;
    }
    const about = (person: { id: string; name: string }) => ({
      payload: {
        conversationId: data.conversationId,
        internalUserId: person.id,
        name: person.name,
      },
      args: { name: person.name },
    });
    return {
      ...about(opener),
      audiences: [{ copy: 'self', recipients: staff(other.id) }],
      forActor: about(other),
    };
  },
  [NotificationType.MESSAGE_RECEIVED]: messageReceived,
};

/**
 * Notices that aren't kept as a record of the actor's own action: a password
 * change or a sign-out everywhere warns its owner the same way whoever made
 * it.
 */
const NO_ACTOR_RECORD: ReadonlySet<ActionType> = new Set([
  NotificationType.PASSWORD_CHANGED,
  NotificationType.SESSIONS_REVOKED,
  // Sending a message is its own record.
  NotificationType.MESSAGE_RECEIVED,
]);

/** Every row for one occurrence starts with it, which is how onFinalFailure finds them. */
export function actionDedupeKeyPrefix(
  event: Pick<ActionNotificationEvent, 'type' | 'occurrence'>,
): string {
  return `action:${event.type}:${event.occurrence}:`;
}

const keyOf = (recipient: NotificationRecipient) =>
  `${recipient.accountType}:${recipient.id}`;

interface Notified {
  recipient: NotificationRecipient;
  copy: string;
  /** The recipient is the one who acted. */
  ownAction: boolean;
}

/**
 * Everyone to notify, each once and only while their account is active: the
 * person who acted first, with a record of their own action ("You…"), then
 * the audiences, each person in the first one they're in.
 */
async function recipientsOf(
  event: ActionNotificationEvent,
  audiences: Audience[],
  lookup: ActionLookupService,
): Promise<Notified[]> {
  const seen = new Set<string>();
  const picked: Notified[] = [];
  const add = (
    recipient: NotificationRecipient,
    copy: string,
    ownAction: boolean,
  ) => {
    if (!seen.has(keyOf(recipient))) {
      seen.add(keyOf(recipient));
      picked.push({ recipient, copy, ownAction });
    }
  };
  if (event.actor && !NO_ACTOR_RECORD.has(event.type)) {
    add(event.actor, 'actor', true);
  }
  for (const { copy, recipients } of audiences) {
    recipients.forEach((recipient) => add(recipient, copy, false));
  }
  const active = new Set(
    (await lookup.keepActive(picked.map(({ recipient }) => recipient))).map(
      keyOf,
    ),
  );
  return picked.filter(({ recipient }) => active.has(keyOf(recipient)));
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
    for (const { recipient, copy, ownAction } of recipients) {
      const { payload, args } =
        (ownAction && resolution.forActor) || resolution;
      const sent = await notifyOnce(services, {
        recipient,
        type: event.type,
        payload,
        ...actionCopy(services.i18n, event.type, copy, args),
        dedupeKey: `${actionDedupeKeyPrefix(event)}${keyOf(recipient)}`,
        ownAction,
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
