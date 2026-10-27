import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
import { I18nModule } from '../../i18n/i18n.module';
import { AccountType } from '../../common/context/auth-context.types';
import { ShipmentActorType } from '../../shipments/constants/shipment-actor';
import { ShipmentState } from '../../shipments/constants/shipment-state';
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
import {
  ShipmentEventSummary,
  ShipmentLookupService,
} from '../../notifications/shipment-lookup.service';
import { ActionLookupService } from '../../notifications/action-lookup.service';
import { WebhooksService } from '../../webhooks/webhooks.service';
import { ShipmentEventNotificationEvent } from '../events/shipment-event-notification.event';
import { JobServices } from '../interfaces/job-handler.interface';
import {
  shipmentEventNotificationHandler as handler,
  shipmentUpdateCopy,
} from './shipment-event-notification.handler';

/** Notification rows by dedupe key, with the unique key's create-once behaviour. */
class FakeNotifications {
  rows = new Map<string, Notification>();
  sent: string[] = [];
  /** Ids whose next markSent throws once, like a delivery that fails. */
  failNextSend = new Set<string>();

  async createOnce(input: CreateNotificationInput) {
    const existing = this.rows.get(input.dedupeKey);
    if (existing) {
      return { notification: existing, created: false };
    }
    const now = new Date();
    const notification: Notification = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      userId: input.recipient.id,
      accountType: input.recipient.accountType,
      type: input.type,
      title: input.title,
      message: input.message,
      payload: input.payload,
      ownAction: input.ownAction ?? false,
      status: NotificationStatus.PENDING,
      sentAt: null,
      readAt: null,
      dismissedAt: null,
      dedupeKey: input.dedupeKey,
    };
    this.rows.set(input.dedupeKey, notification);
    return { notification, created: true };
  }

  async markSent(id: string) {
    if (this.failNextSend.delete(id)) {
      throw new Error('delivery failed');
    }
    const row = [...this.rows.values()].find((n) => n.id === id)!;
    row.status = NotificationStatus.SENT;
    row.sentAt = new Date();
    this.sent.push(id);
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

  all(): Notification[] {
    return [...this.rows.values()];
  }

  /** The rows about the action, leaving out the actor's own record of it. */
  news(): Notification[] {
    return this.all().filter((row) => !row.ownAction);
  }

  /** The actor's own record of it, if any. */
  own(): Notification[] {
    return this.all().filter((row) => row.ownAction);
  }
}

const CUSTOMER_ID = randomUUID();
const ADMIN: NotificationRecipient = {
  id: randomUUID(),
  accountType: AccountType.STAFF,
};
const SUPPORT: NotificationRecipient = {
  id: randomUUID(),
  accountType: AccountType.STAFF,
};
/** The staff member who posts the staff steps. */
const STAFF_ACTOR_ID = randomUUID();
const API_KEY_ID = randomUUID();

/** Written by AdminShipmentsService (staff): the customer hears about them. */
const STAFF_ACTIONS = [
  ShipmentState.PENDING_CLIENT_DECISION,
  ShipmentState.CONFIRMED,
  ShipmentState.IN_TRANSIT,
  ShipmentState.OUT_FOR_DELIVERY,
  ShipmentState.DELIVERED,
  ShipmentState.CANCELLED,
];
/** Written by ShipmentsService (the customer): the staff hear about them. */
const CUSTOMER_ACTIONS = [
  ShipmentState.PENDING_SOURCING,
  ShipmentState.PENDING_PAYMENT,
  ShipmentState.PENDING_PAYMENT_CONFIRMATION,
];
/** Written by a partner (public API) or the carrier (webhook): both sides hear about them. */
const OUTSIDE_ACTIONS: Array<[ShipmentActorType, ShipmentState]> = [
  [ShipmentActorType.PARTNER, ShipmentState.IN_TRANSIT],
  [ShipmentActorType.PARTNER, ShipmentState.OUT_FOR_DELIVERY],
  [ShipmentActorType.PARTNER, ShipmentState.DELIVERED],
  [ShipmentActorType.PARTNER, ShipmentState.CANCELLED],
  [ShipmentActorType.CARRIER, ShipmentState.IN_TRANSIT],
  [ShipmentActorType.CARRIER, ShipmentState.OUT_FOR_DELIVERY],
  [ShipmentActorType.CARRIER, ShipmentState.DELIVERED],
];

let i18n: I18nService;
let notifications: FakeNotifications;
let lookup: {
  findEvent: jest.Mock<Promise<ShipmentEventSummary | null>, [string]>;
  findShipmentStaff: jest.Mock<Promise<NotificationRecipient[]>, []>;
};
/** Accounts keepActive leaves out, as `accountType:id`. */
let inactive: Set<string>;
let services: JobServices;
let event: ShipmentEventSummary;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [I18nModule],
  }).compile();
  i18n = moduleRef.get(I18nService);
});

beforeEach(() => {
  notifications = new FakeNotifications();
  event = {
    id: randomUUID(),
    status: ShipmentState.CONFIRMED,
    trackingId: 'TRK-4A6F90',
    clientId: CUSTOMER_ID,
    isFirstEvent: false,
    actorType: ShipmentActorType.STAFF,
    actorId: STAFF_ACTOR_ID,
  };
  inactive = new Set();
  lookup = {
    findEvent: jest.fn((_id: string) => Promise.resolve(event)),
    findShipmentStaff: jest.fn(() => Promise.resolve([ADMIN, SUPPORT])),
  };
  services = {
    notificationsService: notifications as unknown as NotificationsService,
    shipmentLookupService: lookup as unknown as ShipmentLookupService,
    actionLookupService: {
      keepActive: jest.fn(async (recipients: NotificationRecipient[]) =>
        recipients.filter(
          ({ id, accountType }) => !inactive.has(`${accountType}:${id}`),
        ),
      ),
    } as unknown as ActionLookupService,
    webhooksService: {} as WebhooksService,
    i18n,
  };
});

function jobFor(shipmentEventId: string): Job<ShipmentEventNotificationEvent> {
  return { data: { shipmentEventId } } as Job<ShipmentEventNotificationEvent>;
}

const run = () => handler.run(jobFor(event.id), services);

/** Whose id an event by each kind of actor records. */
const ACTOR_IDS: Record<ShipmentActorType, string | null> = {
  [ShipmentActorType.CUSTOMER]: CUSTOMER_ID,
  [ShipmentActorType.STAFF]: STAFF_ACTOR_ID,
  [ShipmentActorType.PARTNER]: API_KEY_ID,
  [ShipmentActorType.CARRIER]: null,
};

/** The event as `actorType` wrote it. */
const writtenBy = (
  actorType: ShipmentActorType | null,
  status: ShipmentState,
) => {
  event.actorType = actorType;
  event.actorId = actorType && ACTOR_IDS[actorType];
  event.status = status;
};

describe('shipmentEventNotificationHandler: who gets what', () => {
  it.each(STAFF_ACTIONS)(
    '%s, written by staff, goes to the shipment’s customer only',
    async (status) => {
      writtenBy(ShipmentActorType.STAFF, status);

      await run();

      expect(notifications.news()).toEqual([
        expect.objectContaining({
          userId: CUSTOMER_ID,
          accountType: AccountType.CUSTOMER,
          type: NotificationType.SHIPMENT_UPDATE,
          payload: { trackingId: 'TRK-4A6F90', status, actorType: 'staff' },
          status: NotificationStatus.SENT,
          dedupeKey: `shipment-event:${event.id}:customer:${CUSTOMER_ID}`,
        }),
      ]);
      expect(lookup.findShipmentStaff).not.toHaveBeenCalled();
    },
  );

  it.each(CUSTOMER_ACTIONS)(
    '%s, written by the customer, goes to every staff member who sees shipments',
    async (status) => {
      writtenBy(ShipmentActorType.CUSTOMER, status);

      await run();

      const rows = notifications.news();
      expect(rows.map((row) => row.userId).sort()).toEqual(
        [ADMIN.id, SUPPORT.id].sort(),
      );
      for (const row of rows) {
        expect(row).toMatchObject({
          accountType: AccountType.STAFF,
          payload: { trackingId: 'TRK-4A6F90', status, actorType: 'customer' },
          status: NotificationStatus.SENT,
          dedupeKey: `shipment-event:${event.id}:staff:${row.userId}`,
        });
      }
    },
  );

  it.each(OUTSIDE_ACTIONS)(
    'a %s moving it to %s tells the customer and the staff',
    async (actorType, status) => {
      writtenBy(actorType, status);

      // A partner or the carrier isn't a person: no record for them.
      await expect(run()).resolves.toEqual({ recipients: 3, delivered: 3 });
      expect(notifications.own()).toEqual([]);

      expect(
        notifications
          .all()
          .map((row) => `${row.accountType}:${row.userId}`)
          .sort(),
      ).toEqual(
        [
          `customer:${CUSTOMER_ID}`,
          `staff:${ADMIN.id}`,
          `staff:${SUPPORT.id}`,
        ].sort(),
      );
      for (const row of notifications.all()) {
        expect(row.payload).toEqual({
          trackingId: 'TRK-4A6F90',
          status,
          actorType,
        });
      }
    },
  );

  it('leaves out a deactivated customer', async () => {
    inactive.add(`customer:${CUSTOMER_ID}`);

    await run();

    expect(notifications.news()).toEqual([]);
  });

  it('does nothing when the event is gone (its shipment was deleted)', async () => {
    lookup.findEvent.mockResolvedValue(null);

    await expect(run()).resolves.toEqual({ recipients: 0, delivered: 0 });
    expect(notifications.all()).toEqual([]);
  });

  it('does nothing when no staff member can see shipments', async () => {
    writtenBy(ShipmentActorType.CUSTOMER, ShipmentState.PENDING_SOURCING);
    lookup.findShipmentStaff.mockResolvedValue([]);

    await run();

    expect(notifications.news()).toEqual([]);
  });
});

describe('shipmentEventNotificationHandler: an event from before the actor was recorded', () => {
  it('covers every shipment status', () => {
    expect(
      [...STAFF_ACTIONS, ...CUSTOMER_ACTIONS, ShipmentState.REQUESTED].sort(),
    ).toEqual(Object.values(ShipmentState).sort());
  });

  it.each(STAFF_ACTIONS)('%s goes to the customer', async (status) => {
    writtenBy(null, status);

    await run();

    expect(notifications.all()).toEqual([
      expect.objectContaining({
        userId: CUSTOMER_ID,
        payload: { trackingId: 'TRK-4A6F90', status },
      }),
    ]);
  });

  it.each(CUSTOMER_ACTIONS)('%s goes to the staff', async (status) => {
    writtenBy(null, status);

    await run();

    expect(
      notifications
        .all()
        .map((row) => row.userId)
        .sort(),
    ).toEqual([ADMIN.id, SUPPORT.id].sort());
  });

  it('notifies nobody for a status nothing writes', async () => {
    writtenBy(null, ShipmentState.REQUESTED);

    await expect(run()).resolves.toEqual({ recipients: 0, delivered: 0 });
    expect(notifications.all()).toEqual([]);
  });
});

describe('shipmentEventNotificationHandler: wording', () => {
  it('words it for the customer', async () => {
    writtenBy(ShipmentActorType.STAFF, ShipmentState.CONFIRMED);

    await run();

    expect(notifications.news()[0]).toMatchObject({
      title: 'Payment confirmed',
      message:
        "Your payment for TRK-4A6F90 is confirmed. We'll let you know when it ships.",
    });
  });

  it("calls a shipment that starts at confirmed (a partner's) a new shipment, for both sides", async () => {
    writtenBy(ShipmentActorType.PARTNER, ShipmentState.CONFIRMED);
    event.isFirstEvent = true;

    await run();

    const rows = notifications.all();
    expect(rows.find((row) => row.userId === CUSTOMER_ID)).toMatchObject({
      title: 'New shipment',
      message:
        "A shipment, TRK-4A6F90, was created for you. We'll let you know when it ships.",
    });
    expect(rows.find((row) => row.userId === ADMIN.id)).toMatchObject({
      title: 'New partner shipment',
      message: 'A partner created TRK-4A6F90 through the API.',
    });
    for (const row of rows) {
      expect(row.payload).toEqual({
        trackingId: 'TRK-4A6F90',
        status: 'confirmed',
        isNew: true,
        actorType: 'partner',
      });
    }
  });

  it('keeps "Payment confirmed", without isNew, when confirmed comes later', async () => {
    await run();

    expect(notifications.all()[0]?.payload).toEqual({
      trackingId: 'TRK-4A6F90',
      status: 'confirmed',
      actorType: 'staff',
    });
  });

  it('words it for the staff', async () => {
    writtenBy(
      ShipmentActorType.CUSTOMER,
      ShipmentState.PENDING_PAYMENT_CONFIRMATION,
    );

    await run();

    expect(notifications.news()[0]).toMatchObject({
      title: 'Payment to confirm',
      message:
        'The client paid for TRK-4A6F90. Confirm the payment to start the shipment.',
    });
  });

  /** Every (audience, step, new shipment) a notification can be worded for. */
  type Worded = [AccountType, ShipmentState, boolean];
  const WORDED: Worded[] = [
    ...STAFF_ACTIONS.map((status): Worded => [
      AccountType.CUSTOMER,
      status,
      false,
    ]),
    ...CUSTOMER_ACTIONS.map((status): Worded => [
      AccountType.STAFF,
      status,
      false,
    ]),
    ...OUTSIDE_ACTIONS.flatMap(([, status]): Worded[] => [
      [AccountType.CUSTOMER, status, false],
      [AccountType.STAFF, status, false],
    ]),
    // A partner's new shipment ("created").
    [AccountType.CUSTOMER, ShipmentState.CONFIRMED, true],
    [AccountType.STAFF, ShipmentState.CONFIRMED, true],
  ];

  it.each(WORDED)(
    'has English copy for the %s about %s (new: %s)',
    (audience, status, isFirstEvent) => {
      const copy = shipmentUpdateCopy(i18n, audience, {
        status,
        trackingId: 'TRK-4A6F90',
        isFirstEvent,
      });

      // nestjs-i18n returns the key itself when a translation is missing.
      expect(copy.title).not.toMatch(/^notifications\./);
      expect(copy.message).not.toMatch(/^notifications\./);
      expect(copy.message).toContain('TRK-4A6F90');
    },
  );
});

describe('shipmentEventNotificationHandler: a record for whoever acted', () => {
  it('gives the staff member who acted a record of it, and the customer who acted too', async () => {
    writtenBy(ShipmentActorType.STAFF, ShipmentState.CONFIRMED);
    await run();
    expect(notifications.own()).toEqual([
      expect.objectContaining({
        userId: STAFF_ACTOR_ID,
        accountType: AccountType.STAFF,
        ownAction: true,
        title: 'Payment confirmed',
        message:
          'You confirmed the payment for TRK-4A6F90. Tracking can start.',
        dedupeKey: `shipment-event:${event.id}:staff:${STAFF_ACTOR_ID}`,
      }),
    ]);

    notifications = new FakeNotifications();
    services.notificationsService =
      notifications as unknown as NotificationsService;
    writtenBy(ShipmentActorType.CUSTOMER, ShipmentState.PENDING_PAYMENT);
    await run();
    expect(notifications.own()).toEqual([
      expect.objectContaining({
        userId: CUSTOMER_ID,
        accountType: AccountType.CUSTOMER,
        ownAction: true,
        title: 'Offer accepted',
      }),
    ]);
  });

  it('tells a new request and a rejected offer apart in the customer’s record', async () => {
    writtenBy(ShipmentActorType.CUSTOMER, ShipmentState.PENDING_SOURCING);
    event.isFirstEvent = true;
    await run();
    expect(notifications.own()[0]?.title).toBe('Request sent');

    notifications = new FakeNotifications();
    services.notificationsService =
      notifications as unknown as NotificationsService;
    event.isFirstEvent = false;
    await run();
    expect(notifications.own()[0]?.title).toBe('Offer rejected');
  });

  /** What the person who acted is told: [status, isFirstEvent]. */
  const OWN: Array<[ShipmentState, boolean]> = [
    ...STAFF_ACTIONS.map((status): [ShipmentState, boolean] => [status, false]),
    [ShipmentState.PENDING_SOURCING, true],
    [ShipmentState.PENDING_SOURCING, false],
    [ShipmentState.PENDING_PAYMENT, false],
    [ShipmentState.PENDING_PAYMENT_CONFIRMATION, false],
  ];

  it.each(OWN)(
    'has English copy for the one who moved it to %s (first event: %s)',
    (status, isFirstEvent) => {
      const copy = shipmentUpdateCopy(i18n, 'actor', {
        status,
        trackingId: 'TRK-4A6F90',
        isFirstEvent,
      });

      expect(copy.title).not.toMatch(/^notifications\./);
      expect(copy.message).toMatch(/^You /);
      expect(copy.message).toContain('TRK-4A6F90');
    },
  );
});

describe('shipmentEventNotificationHandler: running again', () => {
  it('creates no new rows and sends nothing twice', async () => {
    writtenBy(ShipmentActorType.CUSTOMER, ShipmentState.PENDING_SOURCING);

    // The customer's own record, and the two staff members.
    await expect(run()).resolves.toEqual({ recipients: 3, delivered: 3 });
    await expect(run()).resolves.toEqual({ recipients: 3, delivered: 0 });

    expect(notifications.all()).toHaveLength(3);
    expect(notifications.sent).toHaveLength(3);
  });

  it('a retry delivers only what the failed attempt left behind', async () => {
    writtenBy(ShipmentActorType.CUSTOMER, ShipmentState.PENDING_SOURCING);
    lookup.findShipmentStaff.mockResolvedValue([ADMIN, SUPPORT]);
    // Fail SUPPORT's delivery once: its row is created on the first run.
    const original = notifications.createOnce.bind(notifications);
    jest
      .spyOn(notifications, 'createOnce')
      .mockImplementation(async (input) => {
        const result = await original(input);
        if (result.created && input.recipient.id === SUPPORT.id) {
          notifications.failNextSend.add(result.notification.id);
        }
        return result;
      });

    await expect(run()).rejects.toThrow('delivery failed');
    await expect(run()).resolves.toEqual({ recipients: 3, delivered: 1 });

    expect(notifications.all()).toHaveLength(3);
    expect(
      notifications
        .all()
        .every((row) => row.status === NotificationStatus.SENT),
    ).toBe(true);
  });
});

describe('shipmentEventNotificationHandler.onFinalFailure', () => {
  it('fails the rows of this event that never went out, and only those', async () => {
    writtenBy(ShipmentActorType.CUSTOMER, ShipmentState.PENDING_SOURCING);
    await run();
    const [delivered] = notifications.all();
    const stuck = (
      await notifications.createOnce({
        recipient: { id: randomUUID(), accountType: AccountType.STAFF },
        type: NotificationType.SHIPMENT_UPDATE,
        payload: { trackingId: 'TRK-4A6F90', status: event.status },
        title: 't',
        message: 'm',
        dedupeKey: `shipment-event:${event.id}:staff:late`,
      })
    ).notification;
    const otherEvent = (
      await notifications.createOnce({
        recipient: ADMIN,
        type: NotificationType.SHIPMENT_UPDATE,
        payload: { trackingId: 'TRK-000001', status: event.status },
        title: 't',
        message: 'm',
        dedupeKey: `shipment-event:${randomUUID()}:staff:${ADMIN.id}`,
      })
    ).notification;

    await handler.onFinalFailure!(jobFor(event.id), services);

    expect(stuck.status).toBe(NotificationStatus.FAILED);
    expect(delivered.status).toBe(NotificationStatus.SENT);
    expect(otherEvent.status).toBe(NotificationStatus.PENDING);
  });
});
