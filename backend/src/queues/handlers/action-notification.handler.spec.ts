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
import {
  CreateNotificationInput,
  NotificationRecipient,
  NotificationsService,
} from '../../notifications/notifications.service';
import { ActionLookupService } from '../../notifications/action-lookup.service';
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
}

const staff = (id: string): NotificationRecipient => ({
  id,
  accountType: AccountType.STAFF,
});
const key = (recipient: NotificationRecipient) =>
  `${recipient.accountType}:${recipient.id}`;

// The mock world: two admins (one acts), a branch with two members (one of
// them deactivated), two support agents, a customer.
const ADMIN = staff('admin-1');
const OTHER_ADMIN = staff('admin-2');
const MEMBER = staff('member-1');
const INACTIVE_MEMBER = staff('member-2');
const SUPPORT = staff('support-1');
const CUSTOMER: NotificationRecipient = {
  id: 'customer-1',
  accountType: AccountType.CUSTOMER,
};
const INACTIVE = new Set([INACTIVE_MEMBER.id]);

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
    activeStaffIds: jest.fn(
      async (ids: string[]) => new Set(ids.filter((id) => !INACTIVE.has(id))),
    ),
    findStaff: jest.fn(async (id: string) => ({
      id,
      name: 'Rami Khoury',
      roleName: 'dispatcher',
      organizationId: 'org-1',
      organizationName: 'Beirut Central',
    })),
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
    i18n,
  };
});

const run = (event: ActionNotificationEvent) =>
  handler.run({ data: event } as Job<ActionNotificationEvent>, services);

/** One event of each type, acted on by ADMIN (the password change by MEMBER, on their own account). */
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
};

/** Who each action reaches, given EVENTS: never the actor (but for the password notice), never an inactive account. */
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
};

describe('actionNotificationHandler: who gets what', () => {
  it.each(Object.values(EVENTS).map((event) => [event.type, event] as const))(
    '%s',
    async (type, event) => {
      await run(event);

      expect(notifications.recipients()).toEqual(
        EXPECTED[type].map(key).sort(),
      );
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

  it('leaves out the actor, even when they belong to the audience', async () => {
    // ADMIN is in the support audience; as the one who acted, they're left out.
    await run({
      ...EVENTS[NotificationType.SUPPORT_CONVERSATION_STARTED],
      actor: ADMIN,
    });

    expect(notifications.recipients()).toEqual([key(SUPPORT)]);
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

  it('a member who is also an admin gets one notification, worded for the branch', async () => {
    await run({
      ...EVENTS[NotificationType.BRANCH_UPDATED],
      data: {
        ...EVENTS[NotificationType.BRANCH_UPDATED].data,
        staffIds: [OTHER_ADMIN.id],
      },
    });

    const [row] = [...notifications.rows.values()];
    expect(notifications.rows.size).toBe(1);
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

    const [row] = [...notifications.rows.values()];
    expect(row.message).toContain('TRK-4A6F90');
    expect(row.payload).toEqual({
      trackingId: 'TRK-4A6F90',
      kind,
      fileName: 'scan.pdf',
    });
  });
});

describe('actionNotificationHandler: running again', () => {
  it('creates no new rows and delivers nothing twice', async () => {
    const event = EVENTS[NotificationType.BRANCH_UPDATED];

    await expect(run(event)).resolves.toEqual({ recipients: 2, delivered: 2 });
    await expect(run(event)).resolves.toEqual({ recipients: 2, delivered: 0 });
    expect(notifications.rows.size).toBe(2);
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
