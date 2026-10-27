import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
import { I18nModule } from '../../i18n/i18n.module';
import { AccountType } from '../../common/context/auth-context.types';
import {
  ATTACHMENT_KINDS,
  ShipmentFileKind,
} from '../../shipments/constants/shipment-state';
import {
  NotificationStatus,
  NotificationType,
} from '../../notifications/constants/notification.constants';
import { Notification } from '../../notifications/entities/notification.entity';
import { ConversationType } from '../../chat/entities/conversation.entity';
import {
  CreateNotificationInput,
  NotificationRecipient,
  NotificationsService,
} from '../../notifications/notifications.service';
import { ActionLookupService } from '../../notifications/action-lookup.service';
import { WebhooksService } from '../../webhooks/webhooks.service';
import { ShipmentLookupService } from '../../notifications/shipment-lookup.service';
import {
  ActionNotificationEvent,
  ActionType,
} from '../events/action-notification.event';
import { JobServices } from '../interfaces/job-handler.interface';
import { actionNotificationHandler as handler } from './action-notification.handler';

/** Notification rows by dedupe key, with the unique key's create-once behaviour. */
class FakeNotifications {
  rows = new Map<string, Notification>();

  async createOnce(input: CreateNotificationInput) {
    const existing = this.rows.get(input.dedupeKey);
    if (existing) {
      return { notification: existing, created: false };
    }
    const notification = {
      id: randomUUID(),
      userId: input.recipient.id,
      accountType: input.recipient.accountType,
      type: input.type,
      title: input.title,
      message: input.message,
      payload: input.payload,
      ownAction: input.ownAction ?? false,
      status: NotificationStatus.PENDING,
      dedupeKey: input.dedupeKey,
    } as Notification;
    this.rows.set(input.dedupeKey, notification);
    return { notification, created: true };
  }

  async markSent(id: string) {
    const row = [...this.rows.values()].find((n) => n.id === id)!;
    row.status = NotificationStatus.SENT;
    return true;
  }

  async markPendingFailed(prefix: string) {
    let count = 0;
    for (const row of this.rows.values()) {
      if (
        row.dedupeKey.startsWith(prefix) &&
        row.status === NotificationStatus.PENDING
      ) {
        row.status = NotificationStatus.FAILED;
        count += 1;
      }
    }
    return count;
  }

  /** Who got a row, as "staff:<id>" / "customer:<id>", sorted. */
  recipients(): string[] {
    return [...this.rows.values()]
      .map((row) => `${row.accountType}:${row.userId}`)
      .sort();
  }

  /** The rows about the action, leaving out the actor's own record of it. */
  news(): Notification[] {
    return [...this.rows.values()].filter((row) => !row.ownAction);
  }

  /** Who got news (not their own record), sorted like recipients(). */
  newsRecipients(): string[] {
    return this.news()
      .map((row) => `${row.accountType}:${row.userId}`)
      .sort();
  }

  /** The actor's own record of it. */
  own(): Notification[] {
    return [...this.rows.values()].filter((row) => row.ownAction);
  }
}

const staff = (id: string): NotificationRecipient => ({
  id,
  accountType: AccountType.STAFF,
});
const key = (recipient: NotificationRecipient) =>
  `${recipient.accountType}:${recipient.id}`;

// The mock world: two admins (one acts), a branch with two members (one of
// them deactivated), two support agents, a customer and a deactivated one.
const ADMIN = staff('admin-1');
const OTHER_ADMIN = staff('admin-2');
const MEMBER = staff('member-1');
const INACTIVE_MEMBER = staff('member-2');
const SUPPORT = staff('support-1');
const CUSTOMER: NotificationRecipient = {
  id: 'customer-1',
  accountType: AccountType.CUSTOMER,
};
const INACTIVE_CUSTOMER: NotificationRecipient = {
  id: 'customer-2',
  accountType: AccountType.CUSTOMER,
};
const INACTIVE = new Set([key(INACTIVE_MEMBER), key(INACTIVE_CUSTOMER)]);

let i18n: I18nService;
let notifications: FakeNotifications;
let services: JobServices;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [I18nModule],
  }).compile();
  i18n = moduleRef.get(I18nService);
});

beforeEach(() => {
  notifications = new FakeNotifications();
  const lookup: Partial<Record<keyof ActionLookupService, jest.Mock>> = {
    findAdmins: jest.fn(async () => [ADMIN, OTHER_ADMIN]),
    findSupportStaff: jest.fn(async () => [SUPPORT, ADMIN]),
    keepActive: jest.fn(async (recipients: NotificationRecipient[]) =>
      recipients.filter((recipient) => !INACTIVE.has(key(recipient))),
    ),
    findStaff: jest.fn(async (id: string) => ({
      id,
      name: STAFF_NAMES[id] ?? 'Rami Khoury',
      roleName: 'dispatcher',
      organizationId: 'org-1',
      organizationName: 'Beirut Central',
    })),
    findName: jest.fn(async (account: NotificationRecipient) =>
      account.accountType === AccountType.CUSTOMER
        ? 'Amina El Idrissi'
        : (STAFF_NAMES[account.id] ?? 'Rami Khoury'),
    ),
    findConversation: jest.fn(async (id: string) => CONVERSATIONS[id] ?? null),
    findContact: jest.fn(async () => ({
      requester: { id: MEMBER.id, name: 'Rami Khoury' },
      addressee: { id: OTHER_ADMIN.id, name: 'Youssef Benali' },
    })),
    findCustomerName: jest.fn(async () => 'Amina El Idrissi'),
    findShipment: jest.fn(async () => ({
      trackingId: 'TRK-4A6F90',
      clientId: CUSTOMER.id,
    })),
  };
  services = {
    notificationsService: notifications as unknown as NotificationsService,
    shipmentLookupService: {} as ShipmentLookupService,
    actionLookupService: lookup as unknown as ActionLookupService,
    webhooksService: {} as WebhooksService,
    i18n,
  };
});

const STAFF_NAMES: Record<string, string> = {
  'admin-1': 'Nadia Haddad',
  'admin-2': 'Youssef Benali',
  'member-1': 'Rami Khoury',
};

/** A DM between MEMBER and OTHER_ADMIN, and CUSTOMER's support conversation. */
const CONVERSATIONS: Record<string, object> = {
  'dm-1': {
    id: 'dm-1',
    type: ConversationType.STAFF_DM,
    participantAId: 'member-1',
    participantBId: 'admin-2',
    customerId: null,
  },
  'support-1': {
    id: 'support-1',
    type: ConversationType.SUPPORT,
    participantAId: null,
    participantBId: null,
    customerId: 'customer-1',
  },
};

const run = (event: ActionNotificationEvent) =>
  handler.run({ data: event } as Job<ActionNotificationEvent>, services);

const API_KEY = {
  apiKeyId: 'key-1',
  name: 'Carrier sync',
  organizationId: 'org-1',
  branchName: 'Beirut Central',
  maskedKey: 'stk_9f3a…c4d2',
};

/** MEMBER asked OTHER_ADMIN. */
const CONTACT_PARTIES = {
  contactId: 'contact-1',
  requesterId: 'member-1',
  addresseeId: 'admin-2',
};

/** One event of each type, mostly acted on by ADMIN (the password change by MEMBER, on their own account). */
const EVENTS: { [T in ActionType]: ActionNotificationEvent & { type: T } } = {
  [NotificationType.BRANCH_CREATED]: {
    type: NotificationType.BRANCH_CREATED,
    occurrence: 'org-1',
    actor: ADMIN,
    data: { organizationId: 'org-1', name: 'Beirut Central' },
  },
  [NotificationType.BRANCH_UPDATED]: {
    type: NotificationType.BRANCH_UPDATED,
    occurrence: 'org-1-1',
    actor: ADMIN,
    data: {
      organizationId: 'org-1',
      name: 'Beirut Central',
      staffIds: [MEMBER.id, INACTIVE_MEMBER.id],
    },
  },
  [NotificationType.BRANCH_DEACTIVATED]: {
    type: NotificationType.BRANCH_DEACTIVATED,
    occurrence: 'org-1-2',
    actor: ADMIN,
    data: {
      organizationId: 'org-1',
      name: 'Beirut Central',
      staffIds: [MEMBER.id, INACTIVE_MEMBER.id],
    },
  },
  [NotificationType.BRANCH_STAFF_ADDED]: {
    type: NotificationType.BRANCH_STAFF_ADDED,
    occurrence: 'member-1-1',
    actor: ADMIN,
    data: {
      organizationId: 'org-1',
      name: 'Beirut Central',
      internalUserId: MEMBER.id,
    },
  },
  [NotificationType.BRANCH_STAFF_REMOVED]: {
    type: NotificationType.BRANCH_STAFF_REMOVED,
    occurrence: 'member-1-2',
    actor: ADMIN,
    data: {
      organizationId: 'org-1',
      name: 'Beirut Central',
      internalUserId: MEMBER.id,
    },
  },
  [NotificationType.STAFF_ACCOUNT_CREATED]: {
    type: NotificationType.STAFF_ACCOUNT_CREATED,
    occurrence: 'member-1',
    actor: ADMIN,
    data: { internalUserId: MEMBER.id, name: 'Rami Khoury' },
  },
  [NotificationType.STAFF_ACCOUNT_UPDATED]: {
    type: NotificationType.STAFF_ACCOUNT_UPDATED,
    occurrence: 'member-1-3',
    actor: ADMIN,
    data: {
      internalUserId: MEMBER.id,
      name: 'Rami Khoury',
      changed: ['role'],
    },
  },
  [NotificationType.STAFF_ACCOUNT_DEACTIVATED]: {
    type: NotificationType.STAFF_ACCOUNT_DEACTIVATED,
    occurrence: 'member-1-4',
    actor: ADMIN,
    data: { internalUserId: MEMBER.id, name: 'Rami Khoury' },
  },
  [NotificationType.CONTACT_REQUEST_RECEIVED]: {
    type: NotificationType.CONTACT_REQUEST_RECEIVED,
    occurrence: 'contact-1',
    actor: MEMBER,
    data: { contactId: 'contact-1' },
  },
  [NotificationType.CONTACT_REQUEST_ACCEPTED]: {
    type: NotificationType.CONTACT_REQUEST_ACCEPTED,
    occurrence: 'contact-1-accepted',
    actor: OTHER_ADMIN,
    data: { contactId: 'contact-1' },
  },
  [NotificationType.SUPPORT_CONVERSATION_STARTED]: {
    type: NotificationType.SUPPORT_CONVERSATION_STARTED,
    occurrence: 'conversation-1',
    actor: CUSTOMER,
    data: { conversationId: 'conversation-1', customerId: CUSTOMER.id },
  },
  [NotificationType.SHIPMENT_FILE_ADDED]: {
    type: NotificationType.SHIPMENT_FILE_ADDED,
    occurrence: 'file-1',
    actor: ADMIN,
    data: {
      shipmentId: 'shipment-1',
      kind: ShipmentFileKind.PROOF_OF_DELIVERY,
      fileName: 'proof.pdf',
    },
  },
  [NotificationType.PASSWORD_CHANGED]: {
    type: NotificationType.PASSWORD_CHANGED,
    occurrence: 'member-1-5',
    actor: MEMBER,
    data: { account: MEMBER },
  },
  [NotificationType.API_KEY_CREATED]: {
    type: NotificationType.API_KEY_CREATED,
    occurrence: 'key-1',
    actor: ADMIN,
    data: API_KEY,
  },
  [NotificationType.API_KEY_REVOKED]: {
    type: NotificationType.API_KEY_REVOKED,
    occurrence: 'key-1-revoked',
    actor: ADMIN,
    data: API_KEY,
  },
  [NotificationType.CUSTOMER_REGISTERED]: {
    type: NotificationType.CUSTOMER_REGISTERED,
    occurrence: 'customer-1',
    // Signing up isn't done signed in.
    actor: null,
    data: { customerId: CUSTOMER.id, name: 'Amina El Idrissi' },
  },
  [NotificationType.PROFILE_UPDATED]: {
    type: NotificationType.PROFILE_UPDATED,
    occurrence: 'customer-1-1',
    actor: CUSTOMER,
    data: { account: CUSTOMER, change: 'avatar' },
  },
  [NotificationType.CUSTOMER_ACCOUNT_DEACTIVATED]: {
    type: NotificationType.CUSTOMER_ACCOUNT_DEACTIVATED,
    occurrence: 'customer-2-deactivated',
    actor: INACTIVE_CUSTOMER,
    data: { customerId: INACTIVE_CUSTOMER.id },
  },
  [NotificationType.SESSIONS_REVOKED]: {
    type: NotificationType.SESSIONS_REVOKED,
    occurrence: 'member-1-1',
    actor: MEMBER,
    data: { account: MEMBER },
  },
  [NotificationType.CONTACT_REQUEST_DECLINED]: {
    type: NotificationType.CONTACT_REQUEST_DECLINED,
    occurrence: 'contact-1-removed',
    actor: OTHER_ADMIN,
    data: CONTACT_PARTIES,
  },
  [NotificationType.CONTACT_REQUEST_CANCELLED]: {
    type: NotificationType.CONTACT_REQUEST_CANCELLED,
    occurrence: 'contact-1-removed',
    actor: MEMBER,
    data: CONTACT_PARTIES,
  },
  [NotificationType.CONTACT_REMOVED]: {
    type: NotificationType.CONTACT_REMOVED,
    occurrence: 'contact-1-removed',
    actor: MEMBER,
    data: CONTACT_PARTIES,
  },
  [NotificationType.CONTACT_BLOCKED]: {
    type: NotificationType.CONTACT_BLOCKED,
    occurrence: 'contact-1-blocked',
    actor: OTHER_ADMIN,
    data: CONTACT_PARTIES,
  },
  [NotificationType.CONVERSATION_STARTED]: {
    type: NotificationType.CONVERSATION_STARTED,
    occurrence: 'dm-1',
    actor: MEMBER,
    data: {
      conversationId: 'dm-1',
      participantIds: [MEMBER.id, OTHER_ADMIN.id],
    },
  },
  [NotificationType.MESSAGE_RECEIVED]: {
    type: NotificationType.MESSAGE_RECEIVED,
    occurrence: 'dm-1-member-1-1',
    // A socket message has no request context.
    actor: null,
    data: { conversationId: 'dm-1', sender: MEMBER },
  },
};

/**
 * Who hears about each action, given EVENTS, besides the actor's own record:
 * never an inactive account, and the actor only as their record (the password
 * notice reaches its owner as news, whoever changed it).
 */
const EXPECTED: Record<ActionType, NotificationRecipient[]> = {
  [NotificationType.BRANCH_CREATED]: [OTHER_ADMIN],
  [NotificationType.BRANCH_UPDATED]: [MEMBER, OTHER_ADMIN],
  [NotificationType.BRANCH_DEACTIVATED]: [MEMBER, OTHER_ADMIN],
  [NotificationType.BRANCH_STAFF_ADDED]: [MEMBER],
  [NotificationType.BRANCH_STAFF_REMOVED]: [MEMBER],
  [NotificationType.STAFF_ACCOUNT_CREATED]: [OTHER_ADMIN],
  [NotificationType.STAFF_ACCOUNT_UPDATED]: [MEMBER, OTHER_ADMIN],
  [NotificationType.STAFF_ACCOUNT_DEACTIVATED]: [OTHER_ADMIN],
  [NotificationType.CONTACT_REQUEST_RECEIVED]: [OTHER_ADMIN],
  [NotificationType.CONTACT_REQUEST_ACCEPTED]: [MEMBER],
  [NotificationType.SUPPORT_CONVERSATION_STARTED]: [SUPPORT, ADMIN],
  [NotificationType.SHIPMENT_FILE_ADDED]: [CUSTOMER],
  [NotificationType.PASSWORD_CHANGED]: [MEMBER],
  [NotificationType.API_KEY_CREATED]: [OTHER_ADMIN],
  [NotificationType.API_KEY_REVOKED]: [OTHER_ADMIN],
  [NotificationType.CUSTOMER_REGISTERED]: [CUSTOMER, ADMIN, OTHER_ADMIN],
  // The owner did it: they only get their record.
  [NotificationType.PROFILE_UPDATED]: [],
  [NotificationType.CUSTOMER_ACCOUNT_DEACTIVATED]: [ADMIN, OTHER_ADMIN],
  [NotificationType.SESSIONS_REVOKED]: [MEMBER],
  // Only the one who did it gets a record: the other person isn't told.
  [NotificationType.CONTACT_REQUEST_DECLINED]: [],
  [NotificationType.CONTACT_REQUEST_CANCELLED]: [],
  [NotificationType.CONTACT_REMOVED]: [],
  [NotificationType.CONTACT_BLOCKED]: [],
  [NotificationType.CONVERSATION_STARTED]: [OTHER_ADMIN],
  [NotificationType.MESSAGE_RECEIVED]: [OTHER_ADMIN],
};

/**
 * Who gets a record of their own action: the actor, but for the security
 * notices and messages, and an actor whose account is no longer active.
 */
const NO_RECORD: ReadonlySet<ActionType> = new Set([
  NotificationType.PASSWORD_CHANGED,
  NotificationType.SESSIONS_REVOKED,
  NotificationType.MESSAGE_RECEIVED,
  NotificationType.CUSTOMER_ACCOUNT_DEACTIVATED,
]);

describe('actionNotificationHandler: who gets what', () => {
  it.each(Object.values(EVENTS).map((event) => [event.type, event] as const))(
    '%s',
    async (type, event) => {
      await run(event);

      expect(notifications.newsRecipients()).toEqual(
        EXPECTED[type].map(key).sort(),
      );
      expect(
        notifications.own().map((row) => `${row.accountType}:${row.userId}`),
      ).toEqual(NO_RECORD.has(type) || !event.actor ? [] : [key(event.actor)]);
      for (const row of notifications.rows.values()) {
        expect(row).toMatchObject({
          type,
          status: NotificationStatus.SENT,
        });
        expect(row.dedupeKey).toBe(
          `action:${type}:${event.occurrence}:${row.accountType}:${row.userId}`,
        );
        // nestjs-i18n returns the key itself when a translation is missing.
        expect(row.title).not.toMatch(/^notifications\./);
        expect(row.message).not.toMatch(/^notifications\./);
      }
    },
  );

  it('gives the actor one row, their own record, even when they belong to an audience', async () => {
    // ADMIN is in the support audience; as the one who acted, they get their record instead.
    await run({
      ...EVENTS[NotificationType.SUPPORT_CONVERSATION_STARTED],
      actor: ADMIN,
    });

    expect(notifications.recipients()).toEqual(
      [key(ADMIN), key(SUPPORT)].sort(),
    );
    expect(notifications.own()).toEqual([
      expect.objectContaining({
        userId: ADMIN.id,
        ownAction: true,
        title: 'Support conversation started',
      }),
    ]);
  });

  it('records nothing for the actor when nobody acted (a seed or a job)', async () => {
    await run({ ...EVENTS[NotificationType.BRANCH_CREATED], actor: null });

    expect(notifications.own()).toEqual([]);
    expect(notifications.newsRecipients()).toEqual(
      [key(ADMIN), key(OTHER_ADMIN)].sort(),
    );
  });

  it('a password notice reaches the owner even when they changed it, and without an actor (a reset)', async () => {
    await run(EVENTS[NotificationType.PASSWORD_CHANGED]);
    await run({
      ...EVENTS[NotificationType.PASSWORD_CHANGED],
      occurrence: 'customer-1-9',
      actor: null,
      data: { account: CUSTOMER },
    });

    expect(notifications.recipients()).toEqual([key(CUSTOMER), key(MEMBER)]);
  });

  it('notifies nobody when the thing is gone before the job runs (a declined request)', async () => {
    (
      services.actionLookupService.findContact as unknown as jest.Mock
    ).mockResolvedValue(null);

    await expect(
      run(EVENTS[NotificationType.CONTACT_REQUEST_RECEIVED]),
    ).resolves.toEqual({ recipients: 0, delivered: 0 });
    expect(notifications.rows.size).toBe(0);
  });

  it('leaves out a deactivated customer (a file added to their old order)', async () => {
    (
      services.actionLookupService.findShipment as unknown as jest.Mock
    ).mockResolvedValue({
      trackingId: 'TRK-4A6F90',
      clientId: INACTIVE_CUSTOMER.id,
    });

    await run(EVENTS[NotificationType.SHIPMENT_FILE_ADDED]);

    expect(notifications.news()).toEqual([]);
  });

  it('a member who is also an admin gets one notification, worded for the branch', async () => {
    await run({
      ...EVENTS[NotificationType.BRANCH_UPDATED],
      data: {
        ...EVENTS[NotificationType.BRANCH_UPDATED].data,
        staffIds: [OTHER_ADMIN.id],
      },
    });

    const [row] = notifications.news();
    expect(notifications.news()).toHaveLength(1);
    expect(row).toMatchObject({
      userId: OTHER_ADMIN.id,
      title: 'Your branch was updated',
    });
  });
});

describe('actionNotificationHandler: wording and payload', () => {
  it('words a staff update for the person and for the other admins, with the account as it is now', async () => {
    await run(EVENTS[NotificationType.STAFF_ACCOUNT_UPDATED]);

    const rows = [...notifications.rows.values()];
    const forMember = rows.find((row) => row.userId === MEMBER.id)!;
    const forAdmin = rows.find((row) => row.userId === OTHER_ADMIN.id)!;
    expect(forMember.title).toBe('Your account was updated');
    expect(forAdmin).toMatchObject({
      title: 'Staff account updated',
      message: "Rami Khoury's account was updated.",
    });
    expect(forAdmin.payload).toEqual({
      internalUserId: MEMBER.id,
      name: 'Rami Khoury',
      changed: ['role'],
      roleName: 'dispatcher',
      organizationId: 'org-1',
      organizationName: 'Beirut Central',
    });
  });

  it.each(ATTACHMENT_KINDS)('words a %s for the customer', async (kind) => {
    await run({
      ...EVENTS[NotificationType.SHIPMENT_FILE_ADDED],
      occurrence: `file-${kind}`,
      data: { shipmentId: 'shipment-1', kind, fileName: 'scan.pdf' },
    });

    const [row] = notifications.news();
    expect(row.message).toContain('TRK-4A6F90');
    expect(row.payload).toEqual({
      trackingId: 'TRK-4A6F90',
      kind,
      fileName: 'scan.pdf',
    });
  });
});

describe('actionNotificationHandler: the actor’s own record', () => {
  it('words it for them, with ownAction set', async () => {
    await run(EVENTS[NotificationType.BRANCH_STAFF_ADDED]);

    expect(notifications.own()).toEqual([
      expect.objectContaining({
        userId: ADMIN.id,
        ownAction: true,
        title: 'Member added',
        message: 'You added Rami Khoury to Beirut Central.',
        payload: {
          organizationId: 'org-1',
          name: 'Beirut Central',
          staffName: 'Rami Khoury',
        },
      }),
    ]);
    expect(notifications.news()[0]?.ownAction).toBe(false);
  });

  it('names the other person in a contact notice, for each side', async () => {
    await run(EVENTS[NotificationType.CONTACT_REQUEST_RECEIVED]);

    // MEMBER (Rami) asked OTHER_ADMIN (Youssef).
    const [own] = notifications.own();
    const [news] = notifications.news();
    expect(own).toMatchObject({
      userId: MEMBER.id,
      message: 'You asked Youssef Benali to be a contact.',
      payload: { internalUserId: OTHER_ADMIN.id, name: 'Youssef Benali' },
    });
    expect(news).toMatchObject({
      userId: OTHER_ADMIN.id,
      payload: { internalUserId: MEMBER.id, name: 'Rami Khoury' },
    });
  });

  it('has English copy for the actor of every action but the password notice', async () => {
    for (const event of Object.values(EVENTS)) {
      notifications = new FakeNotifications();
      services.notificationsService =
        notifications as unknown as NotificationsService;
      await run(event);
      for (const row of notifications.own()) {
        expect(row.title).not.toMatch(/^notifications\./);
        expect(row.message).toMatch(/^(You|Our) /);
      }
    }
  });
});

describe('actionNotificationHandler: contacts, conversations and messages', () => {
  it('a declined request is a record for the one who declined, about the requester', async () => {
    await run(EVENTS[NotificationType.CONTACT_REQUEST_DECLINED]);

    expect(notifications.newsRecipients()).toEqual([]);
    expect(notifications.own()).toEqual([
      expect.objectContaining({
        userId: OTHER_ADMIN.id,
        message: "You declined Rami Khoury's contact request.",
        payload: {
          contactId: 'contact-1',
          internalUserId: MEMBER.id,
          name: 'Rami Khoury',
        },
      }),
    ]);
  });

  it('a new DM tells the other person who opened it, and gives the opener a record naming them', async () => {
    await run(EVENTS[NotificationType.CONVERSATION_STARTED]);

    const [news] = notifications.news();
    const [own] = notifications.own();
    expect(news).toMatchObject({
      userId: OTHER_ADMIN.id,
      message: 'Rami Khoury started a conversation with you.',
      payload: { conversationId: 'dm-1', internalUserId: MEMBER.id },
    });
    expect(own).toMatchObject({
      userId: MEMBER.id,
      message: 'You started a conversation with Youssef Benali.',
      payload: { conversationId: 'dm-1', internalUserId: OTHER_ADMIN.id },
    });
  });

  it('a customer’s support message goes to the support staff; a staff reply to the customer', async () => {
    await run({
      ...EVENTS[NotificationType.MESSAGE_RECEIVED],
      occurrence: 'support-1-customer-1-1',
      data: { conversationId: 'support-1', sender: CUSTOMER },
    });
    expect(notifications.newsRecipients()).toEqual(
      [key(ADMIN), key(SUPPORT)].sort(),
    );
    expect(notifications.news()[0]).toMatchObject({
      title: 'New support message',
      payload: {
        conversationId: 'support-1',
        conversationType: ConversationType.SUPPORT,
        senderName: 'Amina El Idrissi',
      },
    });

    notifications = new FakeNotifications();
    services.notificationsService =
      notifications as unknown as NotificationsService;
    await run({
      ...EVENTS[NotificationType.MESSAGE_RECEIVED],
      occurrence: 'support-1-admin-1-1',
      data: { conversationId: 'support-1', sender: ADMIN },
    });
    expect(notifications.newsRecipients()).toEqual([key(CUSTOMER)]);
  });

  it('never tells the sender about their own message', async () => {
    await run({
      ...EVENTS[NotificationType.MESSAGE_RECEIVED],
      data: { conversationId: 'dm-1', sender: OTHER_ADMIN },
    });

    expect(notifications.recipients()).toEqual([key(MEMBER)]);
  });
});

describe('actionNotificationHandler: running again', () => {
  it('creates no new rows and delivers nothing twice', async () => {
    const event = EVENTS[NotificationType.BRANCH_UPDATED];

    // ADMIN's own record, MEMBER and OTHER_ADMIN.
    await expect(run(event)).resolves.toEqual({ recipients: 3, delivered: 3 });
    await expect(run(event)).resolves.toEqual({ recipients: 3, delivered: 0 });
    expect(notifications.rows.size).toBe(3);
  });

  it("onFinalFailure fails this occurrence's undelivered rows only", async () => {
    const event = EVENTS[NotificationType.BRANCH_CREATED];
    await notifications.createOnce({
      recipient: OTHER_ADMIN,
      type: NotificationType.BRANCH_CREATED,
      payload: { organizationId: 'org-1', name: 'x' },
      title: 't',
      message: 'm',
      dedupeKey: `action:BRANCH_CREATED:org-1:staff:${OTHER_ADMIN.id}`,
    });
    const other = await notifications.createOnce({
      recipient: OTHER_ADMIN,
      type: NotificationType.BRANCH_CREATED,
      payload: { organizationId: 'org-10', name: 'x' },
      title: 't',
      message: 'm',
      dedupeKey: `action:BRANCH_CREATED:org-10:staff:${OTHER_ADMIN.id}`,
    });

    await handler.onFinalFailure!(
      { data: event } as Job<ActionNotificationEvent>,
      services,
    );

    const statuses = [...notifications.rows.values()].map((row) => row.status);
    expect(statuses).toEqual([
      NotificationStatus.FAILED,
      NotificationStatus.PENDING,
    ]);
    expect(other.notification.status).toBe(NotificationStatus.PENDING);
  });
});
