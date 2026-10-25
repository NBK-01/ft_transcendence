import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';
import { AccountType } from '../common/context/auth-context.types';
import { ShipmentState } from '../shipments/constants/shipment-state';
import {
  NotificationStatus,
  NotificationType,
} from './constants/notification.constants';
import { Notification } from './entities/notification.entity';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationNotFoundException } from './exceptions';
import {
  CreateNotificationInput,
  NotificationRecipient,
  NotificationsService,
} from './notifications.service';

type Where = Record<string, unknown>;
type Order = Record<string, 'ASC' | 'DESC'>;

function field(row: Notification, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

/** TypeORM's where semantics for what the service uses: equality, IsNull, Not and In. */
function matches(row: Notification, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    const value = field(row, key);
    if (!(condition instanceof FindOperator)) {
      return value === condition;
    }
    switch (condition.type) {
      case 'isNull':
        return value === null;
      case 'not':
        return value !== condition.value;
      case 'in':
        return (condition.value as unknown[]).includes(value);
      default:
        throw new Error(
          `Fake repository: unsupported operator ${condition.type}`,
        );
    }
  });
}

function sortValue(row: Notification, key: string): number | string {
  const value = field(row, key);
  return value instanceof Date ? value.getTime() : String(value);
}

/**
 * In-memory stand-in for Repository<Notification>, just big enough for the
 * service's queries. The tests can then say what happens ("someone else's
 * row is a 404") instead of checking which query objects were built.
 */
class FakeNotificationRepository {
  rows: Notification[] = [];

  async findAndCount(options: {
    where: Where;
    order: Order;
    skip: number;
    take: number;
  }): Promise<[Notification[], number]> {
    const found = this.sorted(this.filter(options.where), options.order);
    return [
      found.slice(options.skip, options.skip + options.take),
      found.length,
    ];
  }

  async count(options: { where: Where }): Promise<number> {
    return this.filter(options.where).length;
  }

  async findOne(options: { where: Where }): Promise<Notification | null> {
    return this.filter(options.where)[0] ?? null;
  }

  async findOneByOrFail(where: Where): Promise<Notification> {
    const [row] = this.filter(where);
    if (!row) {
      throw new Error('EntityNotFoundError');
    }
    return row;
  }

  async update(
    where: Where,
    changes: Partial<Notification>,
  ): Promise<{ affected: number }> {
    const found = this.filter(where);
    found.forEach((row) => Object.assign(row, changes));
    return { affected: found.length };
  }

  /** The insert chain createOnce uses. Without orIgnore() a duplicate key throws, like the unique constraint. */
  createQueryBuilder() {
    let values: Partial<Notification> = {};
    let ignoreConflicts = false;
    const builder = {
      insert: () => builder,
      into: () => builder,
      values: (next: Partial<Notification>) => {
        values = next;
        return builder;
      },
      orIgnore: () => {
        ignoreConflicts = true;
        return builder;
      },
      returning: () => builder,
      execute: async () => {
        if (this.rows.some((row) => row.dedupeKey === values.dedupeKey)) {
          if (!ignoreConflicts) {
            throw new Error('duplicate key value violates unique constraint');
          }
          return { raw: [] };
        }
        // Nullable columns the insert leaves out are NULL, as in the database.
        const row = makeNotification({
          sentAt: null,
          readAt: null,
          dismissedAt: null,
          ...values,
          id: randomUUID(),
        });
        this.rows.push(row);
        return { raw: [{ id: row.id }] };
      },
    };
    return builder;
  }

  private filter(where: Where): Notification[] {
    return this.rows.filter((row) => matches(row, where));
  }

  private sorted(rows: Notification[], order: Order): Notification[] {
    return [...rows].sort((a, b) => {
      for (const [key, direction] of Object.entries(order)) {
        const [left, right] = [sortValue(a, key), sortValue(b, key)];
        if (left !== right) {
          return (left < right ? -1 : 1) * (direction === 'ASC' ? 1 : -1);
        }
      }
      return 0;
    });
  }
}

const ME: NotificationRecipient = {
  id: randomUUID(),
  accountType: AccountType.CUSTOMER,
};
const SOMEONE_ELSE: NotificationRecipient = {
  id: randomUUID(),
  accountType: AccountType.CUSTOMER,
};

let clock = 0;

/** A SENT shipment notification for ME, each one created a minute after the previous. */
function makeNotification(overrides: Partial<Notification> = {}): Notification {
  clock += 1;
  const createdAt = new Date(Date.UTC(2026, 9, 25, 9, clock));
  return {
    id: randomUUID(),
    createdAt,
    updatedAt: createdAt,
    userId: ME.id,
    accountType: ME.accountType,
    type: NotificationType.SHIPMENT_UPDATE,
    title: 'Out for delivery',
    message: 'TRK-4A6F90 is out for delivery.',
    payload: {
      trackingId: 'TRK-4A6F90',
      status: ShipmentState.OUT_FOR_DELIVERY,
    },
    status: NotificationStatus.SENT,
    sentAt: createdAt,
    readAt: null,
    dismissedAt: null,
    dedupeKey: `test:${randomUUID()}`,
    ...overrides,
  };
}

function listQuery(
  overrides: Partial<ListNotificationsQueryDto> = {},
): ListNotificationsQueryDto {
  return Object.assign(new ListNotificationsQueryDto(), overrides);
}

let repository: FakeNotificationRepository;
let service: NotificationsService;

function seed(...rows: Notification[]): Notification[] {
  repository.rows.push(...rows);
  return rows;
}

// Top level, so it runs before every test in the file: each starts with an empty table.
beforeEach(async () => {
  repository = new FakeNotificationRepository();
  const moduleRef = await Test.createTestingModule({
    providers: [
      NotificationsService,
      { provide: getRepositoryToken(Notification), useValue: repository },
    ],
  }).compile();
  service = moduleRef.get(NotificationsService);
});

describe('NotificationsService.list', () => {
  it("returns only the caller's notifications, newest first, without dismissed ones", async () => {
    const [older, newer] = seed(
      makeNotification(),
      makeNotification(),
      makeNotification({ dismissedAt: new Date() }),
      makeNotification({ userId: SOMEONE_ELSE.id }),
    );

    const page = await service.list(ME, listQuery());

    expect(page.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(page.meta.totalItems).toBe(2);
  });

  it('keeps customer and staff feeds apart, even for the same id', async () => {
    seed(makeNotification());

    const page = await service.list(
      { id: ME.id, accountType: AccountType.STAFF },
      listQuery(),
    );

    expect(page.items).toEqual([]);
  });

  it('unreadOnly leaves out read notifications, whatever their delivery status', async () => {
    const unread = seed(
      makeNotification({ status: NotificationStatus.PENDING }),
      makeNotification({ status: NotificationStatus.SENT }),
      makeNotification({ status: NotificationStatus.FAILED }),
    );
    seed(
      makeNotification({
        status: NotificationStatus.READ,
        readAt: new Date(),
      }),
    );

    const page = await service.list(ME, listQuery({ unreadOnly: true }));

    expect(page.items.map((item) => item.id).sort()).toEqual(
      unread.map((row) => row.id).sort(),
    );
  });

  it('filters by type', async () => {
    // A type that doesn't exist yet, to show the filter excludes others.
    seed(makeNotification({ type: 'CHAT_MESSAGE' as NotificationType }));
    const [shipmentUpdate] = seed(makeNotification());

    const page = await service.list(
      ME,
      listQuery({ type: NotificationType.SHIPMENT_UPDATE }),
    );

    expect(page.items.map((item) => item.id)).toEqual([shipmentUpdate.id]);
  });

  it('pages with page and limit, and reports the total', async () => {
    const [oldest] = seed(
      makeNotification(),
      makeNotification(),
      makeNotification(),
    );

    const page = await service.list(ME, listQuery({ page: 2, limit: 2 }));

    expect(page.items.map((item) => item.id)).toEqual([oldest.id]);
    expect(page.meta).toEqual({
      page: 2,
      limit: 2,
      totalItems: 3,
      totalPages: 2,
    });
  });
});

describe('NotificationsService.unreadCount', () => {
  it("counts the caller's unread notifications that aren't dismissed", async () => {
    seed(
      makeNotification({ status: NotificationStatus.PENDING }),
      makeNotification({ status: NotificationStatus.SENT }),
      makeNotification({
        status: NotificationStatus.READ,
        readAt: new Date(),
      }),
      makeNotification({ dismissedAt: new Date() }),
      makeNotification({ userId: SOMEONE_ELSE.id }),
    );

    await expect(service.unreadCount(ME)).resolves.toEqual({ count: 2 });
  });
});

describe('NotificationsService.markRead', () => {
  it.each([
    NotificationStatus.PENDING,
    NotificationStatus.SENT,
    NotificationStatus.FAILED,
  ])('marks a %s notification READ and sets readAt', async (status) => {
    const [row] = seed(makeNotification({ status }));

    const dto = await service.markRead(ME, row.id);

    expect(dto.status).toBe(NotificationStatus.READ);
    expect(dto.readAt).toBeInstanceOf(Date);
    expect(row.status).toBe(NotificationStatus.READ);
    expect(row.readAt).toEqual(dto.readAt);
  });

  it('is idempotent: reading it again keeps the first readAt', async () => {
    const firstReadAt = new Date(Date.UTC(2026, 9, 1));
    const [row] = seed(
      makeNotification({
        status: NotificationStatus.READ,
        readAt: firstReadAt,
      }),
    );

    const dto = await service.markRead(ME, row.id);

    expect(dto.readAt).toEqual(firstReadAt);
    expect(row.readAt).toEqual(firstReadAt);
  });

  it("is a 404 for someone else's notification, which stays unread", async () => {
    const [theirs] = seed(makeNotification({ userId: SOMEONE_ELSE.id }));

    await expect(service.markRead(ME, theirs.id)).rejects.toBeInstanceOf(
      NotificationNotFoundException,
    );
    expect(theirs.status).toBe(NotificationStatus.SENT);
    expect(theirs.readAt).toBeNull();
  });

  it('is a 404 for a dismissed notification', async () => {
    const [row] = seed(makeNotification({ dismissedAt: new Date() }));

    await expect(service.markRead(ME, row.id)).rejects.toBeInstanceOf(
      NotificationNotFoundException,
    );
  });

  it('is a 404 for an unknown id', async () => {
    await expect(service.markRead(ME, randomUUID())).rejects.toBeInstanceOf(
      NotificationNotFoundException,
    );
  });
});

describe('NotificationsService.markAllRead', () => {
  it("marks the caller's unread notifications and returns how many", async () => {
    const mine = seed(
      makeNotification({ status: NotificationStatus.PENDING }),
      makeNotification({ status: NotificationStatus.SENT }),
    );
    const firstReadAt = new Date(Date.UTC(2026, 9, 1));
    const [alreadyRead, dismissed, theirs] = seed(
      makeNotification({
        status: NotificationStatus.READ,
        readAt: firstReadAt,
      }),
      makeNotification({ dismissedAt: new Date() }),
      makeNotification({ userId: SOMEONE_ELSE.id }),
    );

    await expect(service.markAllRead(ME)).resolves.toEqual({ count: 2 });

    for (const row of mine) {
      expect(row.status).toBe(NotificationStatus.READ);
      expect(row.readAt).toBeInstanceOf(Date);
    }
    expect(alreadyRead.readAt).toEqual(firstReadAt);
    expect(dismissed.status).toBe(NotificationStatus.SENT);
    expect(theirs.status).toBe(NotificationStatus.SENT);
    await expect(service.unreadCount(ME)).resolves.toEqual({ count: 0 });
  });
});

describe('NotificationsService.dismiss', () => {
  it('takes it out of the list and the unread count', async () => {
    const [row] = seed(makeNotification());

    await service.dismiss(ME, row.id);

    expect(row.dismissedAt).toBeInstanceOf(Date);
    expect((await service.list(ME, listQuery())).items).toEqual([]);
    await expect(service.unreadCount(ME)).resolves.toEqual({ count: 0 });
  });

  it("is a 404 for someone else's notification, which they still see", async () => {
    const [theirs] = seed(makeNotification({ userId: SOMEONE_ELSE.id }));

    await expect(service.dismiss(ME, theirs.id)).rejects.toBeInstanceOf(
      NotificationNotFoundException,
    );
    const page = await service.list(SOMEONE_ELSE, listQuery());
    expect(page.items.map((item) => item.id)).toEqual([theirs.id]);
  });

  it('is a 404 the second time', async () => {
    const [row] = seed(makeNotification());
    await service.dismiss(ME, row.id);

    await expect(service.dismiss(ME, row.id)).rejects.toBeInstanceOf(
      NotificationNotFoundException,
    );
  });
});

describe('NotificationsService.createOnce', () => {
  const input = (dedupeKey: string): CreateNotificationInput => ({
    recipient: ME,
    type: NotificationType.SHIPMENT_UPDATE,
    payload: { trackingId: 'TRK-4A6F90', status: ShipmentState.IN_TRANSIT },
    title: 'In transit',
    message: 'TRK-4A6F90 is on its way.',
    dedupeKey,
  });

  it('creates a PENDING notification for the recipient', async () => {
    const { notification, created } = await service.createOnce(
      input('shipment-event:1:me'),
    );

    expect(created).toBe(true);
    expect(notification).toMatchObject({
      userId: ME.id,
      accountType: ME.accountType,
      type: NotificationType.SHIPMENT_UPDATE,
      status: NotificationStatus.PENDING,
      payload: { trackingId: 'TRK-4A6F90', status: ShipmentState.IN_TRANSIT },
      dedupeKey: 'shipment-event:1:me',
    });
    expect(repository.rows).toHaveLength(1);
  });

  it('never creates a second row for the same key, and returns the first one', async () => {
    const first = await service.createOnce(input('shipment-event:1:me'));
    await service.markSent(first.notification.id);

    const again = await service.createOnce(input('shipment-event:1:me'));

    expect(again.created).toBe(false);
    expect(again.notification.id).toBe(first.notification.id);
    // The retry can see the first attempt already delivered it.
    expect(again.notification.status).toBe(NotificationStatus.SENT);
    expect(repository.rows).toHaveLength(1);
  });

  it('creates one row per key', async () => {
    await service.createOnce(input('shipment-event:1:me'));
    await service.createOnce(input('shipment-event:2:me'));

    expect(repository.rows).toHaveLength(2);
  });
});

describe('NotificationsService.markSent and markFailed', () => {
  it.each([NotificationStatus.PENDING, NotificationStatus.FAILED])(
    'markSent moves %s to SENT and sets sentAt',
    async (status) => {
      const [row] = seed(makeNotification({ status, sentAt: null }));

      await expect(service.markSent(row.id)).resolves.toBe(true);

      expect(row.status).toBe(NotificationStatus.SENT);
      expect(row.sentAt).toBeInstanceOf(Date);
    },
  );

  it('markSent leaves a notification that was already read alone', async () => {
    const [row] = seed(
      makeNotification({
        status: NotificationStatus.READ,
        readAt: new Date(),
        sentAt: null,
      }),
    );

    await expect(service.markSent(row.id)).resolves.toBe(false);

    expect(row.status).toBe(NotificationStatus.READ);
    expect(row.sentAt).toBeNull();
  });

  it('markFailed only moves a PENDING notification', async () => {
    const [pending, sent, read] = seed(
      makeNotification({ status: NotificationStatus.PENDING }),
      makeNotification({ status: NotificationStatus.SENT }),
      makeNotification({ status: NotificationStatus.READ }),
    );

    await expect(service.markFailed(pending.id)).resolves.toBe(true);
    await expect(service.markFailed(sent.id)).resolves.toBe(false);
    await expect(service.markFailed(read.id)).resolves.toBe(false);

    expect(pending.status).toBe(NotificationStatus.FAILED);
    expect(sent.status).toBe(NotificationStatus.SENT);
    expect(read.status).toBe(NotificationStatus.READ);
  });
});
