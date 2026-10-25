import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
import { I18nModule } from '../../i18n/i18n.module';
import { AccountType } from '../../common/context/auth-context.types';
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
import { ShipmentEventNotificationEvent } from '../events/shipment-event-notification.event';
import { JobServices } from '../interfaces/job-handler.interface';
import {
  AUDIENCE_BY_STATUS,
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

/** Written by AdminShipmentsService: the customer hears about them. */
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

let i18n: I18nService;
let notifications: FakeNotifications;
let lookup: {
  findEvent: jest.Mock<Promise<ShipmentEventSummary | null>, [string]>;
  findShipmentStaff: jest.Mock<Promise<NotificationRecipient[]>, []>;
};
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
  };
  lookup = {
    findEvent: jest.fn((_id: string) => Promise.resolve(event)),
    findShipmentStaff: jest.fn(() => Promise.resolve([ADMIN, SUPPORT])),
  };
  services = {
    notificationsService: notifications as unknown as NotificationsService,
    shipmentLookupService: lookup as unknown as ShipmentLookupService,
    i18n,
  };
});

function jobFor(shipmentEventId: string): Job<ShipmentEventNotificationEvent> {
  return { data: { shipmentEventId } } as Job<ShipmentEventNotificationEvent>;
}

const run = () => handler.run(jobFor(event.id), services);

describe('shipmentEventNotificationHandler: who gets what', () => {
  it('covers every shipment status', () => {
    expect(
      [...STAFF_ACTIONS, ...CUSTOMER_ACTIONS, ShipmentState.REQUESTED].sort(),
    ).toEqual(Object.values(ShipmentState).sort());
  });

  it.each(STAFF_ACTIONS)(
    '%s (a staff action) goes to the shipment’s customer only',
    async (status) => {
      event.status = status;

      await run();

      expect(notifications.all()).toEqual([
        expect.objectContaining({
          userId: CUSTOMER_ID,
          accountType: AccountType.CUSTOMER,
          type: NotificationType.SHIPMENT_UPDATE,
          payload: { trackingId: 'TRK-4A6F90', status },
          status: NotificationStatus.SENT,
          dedupeKey: `shipment-event:${event.id}:customer:${CUSTOMER_ID}`,
        }),
      ]);
      expect(lookup.findShipmentStaff).not.toHaveBeenCalled();
    },
  );

  it.each(CUSTOMER_ACTIONS)(
    '%s (a customer action) goes to every staff member who sees shipments',
    async (status) => {
      event.status = status;

      await run();

      const rows = notifications.all();
      expect(rows.map((row) => row.userId).sort()).toEqual(
        [ADMIN.id, SUPPORT.id].sort(),
      );
      for (const row of rows) {
        expect(row).toMatchObject({
          accountType: AccountType.STAFF,
          payload: { trackingId: 'TRK-4A6F90', status },
          status: NotificationStatus.SENT,
          dedupeKey: `shipment-event:${event.id}:staff:${row.userId}`,
        });
      }
    },
  );

  it('notifies nobody for a status nothing writes', async () => {
    event.status = ShipmentState.REQUESTED;

    await expect(run()).resolves.toEqual({ recipients: 0, delivered: 0 });
    expect(notifications.all()).toEqual([]);
  });

  it('does nothing when the event is gone (its shipment was deleted)', async () => {
    lookup.findEvent.mockResolvedValue(null);

    await expect(run()).resolves.toEqual({ recipients: 0, delivered: 0 });
    expect(notifications.all()).toEqual([]);
  });

  it('does nothing when no staff member can see shipments', async () => {
    event.status = ShipmentState.PENDING_SOURCING;
    lookup.findShipmentStaff.mockResolvedValue([]);

    await run();

    expect(notifications.all()).toEqual([]);
  });
});

describe('shipmentEventNotificationHandler: wording', () => {
  it('words it for the customer', async () => {
    event.status = ShipmentState.CONFIRMED;

    await run();

    expect(notifications.all()[0]).toMatchObject({
      title: 'Payment confirmed',
      message:
        "Your payment for TRK-4A6F90 is confirmed. We'll let you know when it ships.",
    });
  });

  it('words it for the staff', async () => {
    event.status = ShipmentState.PENDING_PAYMENT_CONFIRMATION;

    await run();

    expect(notifications.all()[0]).toMatchObject({
      title: 'Payment to confirm',
      message:
        'The client paid for TRK-4A6F90. Confirm the payment to start the shipment.',
    });
  });

  it.each(
    Object.entries(AUDIENCE_BY_STATUS).filter(([, audience]) => audience),
  )('has English copy for %s, sent to %s', (status, audience) => {
    const copy = shipmentUpdateCopy(i18n, audience!, {
      status: status as ShipmentState,
      trackingId: 'TRK-4A6F90',
    });

    // nestjs-i18n returns the key itself when a translation is missing.
    expect(copy.title).not.toMatch(/^notifications\./);
    expect(copy.message).not.toMatch(/^notifications\./);
    expect(copy.message).toContain('TRK-4A6F90');
  });
});

describe('shipmentEventNotificationHandler: running again', () => {
  it('creates no new rows and sends nothing twice', async () => {
    event.status = ShipmentState.PENDING_SOURCING;

    await expect(run()).resolves.toEqual({ recipients: 2, delivered: 2 });
    await expect(run()).resolves.toEqual({ recipients: 2, delivered: 0 });

    expect(notifications.all()).toHaveLength(2);
    expect(notifications.sent).toHaveLength(2);
  });

  it('a retry delivers only what the failed attempt left behind', async () => {
    event.status = ShipmentState.PENDING_SOURCING;
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
    await expect(run()).resolves.toEqual({ recipients: 2, delivered: 1 });

    expect(notifications.all()).toHaveLength(2);
    expect(
      notifications
        .all()
        .every((row) => row.status === NotificationStatus.SENT),
    ).toBe(true);
  });
});

describe('shipmentEventNotificationHandler.onFinalFailure', () => {
  it('fails the rows of this event that never went out, and only those', async () => {
    event.status = ShipmentState.PENDING_SOURCING;
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
