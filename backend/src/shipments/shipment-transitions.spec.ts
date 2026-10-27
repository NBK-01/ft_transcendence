import { HttpStatus } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FileStorageService } from '../file-storage/file-storage.service';
import { User } from '../users/user.entity';
import {
  customerActor,
  ShipmentActorType,
  staffActor,
} from './constants/shipment-actor';
import { ShipmentState } from './constants/shipment-state';
import { Shipment } from './entities/shipment.entity';
import { ShipmentEvent } from './entities/shipment-event.entity';
import { ShipmentFile } from './entities/shipment-file.entity';
import { ShipmentOffer } from './entities/shipment-offer.entity';
import { ShipmentPayment } from './entities/shipment-payment.entity';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import {
  InvalidShipmentStateException,
  ShipmentErrorCodes,
} from './exceptions';
import { AdminShipmentsService } from './admin-shipments.service';
import { AccessControlService } from '../access-control/access-control.service';
import { ShipmentsService } from './shipments.service';

/**
 * Status transitions, end to end through both services, against an
 * in-memory stand-in for Postgres.
 *
 * The stand-in's UPDATE behaves like the real conditional one: it only
 * touches the row if its *current* status is in the `from` parameter. So
 * these tests fail if transition() stops putting the status check in the
 * UPDATE itself — the guard that keeps two racing requests from both winning.
 */

const CLIENT_ID = 'client-1';
const TRACKING_ID = 'TRK-ABC123';
const STAFF_ID = 'staff-1';
const ALL_STATES = Object.values(ShipmentState);
const CLIENT = Object.assign(new User(), {
  id: CLIENT_ID,
  name: 'Maria Test',
  email: 'client@test.com',
});

/** A row as the store keeps it: relations always loaded. */
type StoredShipment = Shipment & { offers: ShipmentOffer[] };

interface RecordedUpdate {
  set: Record<string, unknown>;
  conditions: string[];
  params: { id?: string; from?: ShipmentState[] };
}

class FakeShipmentStore {
  readonly rows = new Map<string, StoredShipment>();
  readonly events: Pick<
    ShipmentEvent,
    'shipmentId' | 'status' | 'location' | 'actorType' | 'actorId'
  >[] = [];
  readonly updates: RecordedUpdate[] = [];
  private nextId = 1;

  /** Seeds one shipment, with an open offer once it's past sourcing. */
  seed(status: ShipmentState): StoredShipment {
    const shipment: StoredShipment = Object.assign(new Shipment(), {
      id: `shipment-${this.nextId++}`,
      trackingId: TRACKING_ID,
      clientId: CLIENT_ID,
      client: CLIENT,
      status,
      productUrl: 'https://shop.example.com/item',
      origin: null,
      destination: null,
      offers: [] as ShipmentOffer[],
      files: [],
      payment: null,
      updatedAt: new Date(),
    });
    if (status !== ShipmentState.PENDING_SOURCING) {
      shipment.offers.push(this.offer(shipment.id));
    }
    this.rows.set(shipment.id, shipment);
    return shipment;
  }

  /** What a fresh SELECT returns: a separate copy, so it can go stale. */
  load(id: string): Shipment {
    const row = this.rows.get(id)!;
    return Object.assign(new Shipment(), {
      ...row,
      offers: row.offers.map((offer) => ({ ...offer })),
    });
  }

  readonly repository = {
    findOne: ({
      where,
    }: {
      where: { trackingId: string; clientId?: string };
    }): Promise<Shipment | null> => {
      const row = [...this.rows.values()].find(
        (shipment) =>
          shipment.trackingId === where.trackingId &&
          (where.clientId === undefined ||
            shipment.clientId === where.clientId),
      );
      return Promise.resolve(row ? this.load(row.id) : null);
    },
    exists: () => Promise.resolve(false),
  };

  readonly manager = {
    createQueryBuilder: () => {
      const update: RecordedUpdate = { set: {}, conditions: [], params: {} };
      const builder = {
        update: () => builder,
        set: (values: Record<string, unknown>) => {
          update.set = values;
          return builder;
        },
        where: (condition: string, params: RecordedUpdate['params']) => {
          update.conditions.push(condition);
          Object.assign(update.params, params);
          return builder;
        },
        andWhere: (condition: string, params: RecordedUpdate['params']) =>
          builder.where(condition, params),
        execute: async () => {
          await Promise.resolve(); // let a racing request interleave
          this.updates.push(update);
          const row = this.rows.get(update.params.id ?? '');
          const { from } = update.params;
          if (!row || (from && !from.includes(row.status))) {
            return { affected: 0 };
          }
          Object.assign(row, update.set);
          return { affected: 1 };
        },
      };
      return builder;
    },
    insert: (entity: unknown, values: Record<string, unknown>) => {
      if (entity === ShipmentEvent) {
        this.events.push(values as FakeShipmentStore['events'][number]);
      } else if (entity === ShipmentPayment) {
        this.rows.get(values.shipmentId as string)!.payment = Object.assign(
          new ShipmentPayment(),
          { ...values, createdAt: new Date() },
        );
      }
      return Promise.resolve();
    },
    update: (
      entity: unknown,
      id: string,
      values: Partial<ShipmentOffer>,
    ): Promise<void> => {
      if (entity === ShipmentOffer) {
        for (const row of this.rows.values()) {
          const offer = row.offers.find((candidate) => candidate.id === id);
          if (offer) Object.assign(offer, values);
        }
      }
      return Promise.resolve();
    },
    create: <T extends object>(entity: new () => T, values: Partial<T>): T =>
      Object.assign(new entity(), values),
    save: <T>(entity: T): Promise<T> => {
      if (entity instanceof Shipment) {
        const row = Object.assign(entity, {
          id: `shipment-${this.nextId++}`,
          offers: [] as ShipmentOffer[],
          client: CLIENT,
        });
        this.rows.set(row.id, row);
      } else if (entity instanceof ShipmentOffer) {
        Object.assign(entity, this.offer(entity.shipmentId), { ...entity });
        this.rows.get(entity.shipmentId)!.offers.push(entity);
      }
      return Promise.resolve(entity);
    },
  };

  readonly dataSource = {
    transaction: <T>(work: (manager: EntityManager) => Promise<T>) =>
      work(this.manager as unknown as EntityManager),
  };

  private offer(shipmentId: string): ShipmentOffer {
    return Object.assign(new ShipmentOffer(), {
      id: `offer-${this.nextId++}`,
      shipmentId,
      supplierName: 'Shenzhen Gadget Co.',
      unitPriceAmount: 24.9,
      currency: 'USD',
      note: null,
      rejectedAt: null,
      images: [],
      createdAt: new Date(),
    });
  }
}

function setup() {
  const store = new FakeShipmentStore();
  const fileStorage = {
    getFileUrl: (key: string) => Promise.resolve(`https://signed/${key}`),
    validateShipmentFile: () => undefined,
    uploadShipmentFile: () => Promise.resolve({ key: 'unused' }),
    deleteFile: () => Promise.resolve(),
  };
  const emptyRepository = { find: () => Promise.resolve([]) };
  const shipments = new ShipmentsService(
    store.repository as unknown as Repository<Shipment>,
    emptyRepository as unknown as Repository<ShipmentEvent>,
    emptyRepository as unknown as Repository<ShipmentFile>,
    store.dataSource as unknown as DataSource,
    fileStorage as unknown as FileStorageService,
  );
  const admin = new AdminShipmentsService(
    shipments,
    store.dataSource as unknown as DataSource,
    // An admin: every shipment is in scope (scoping is admin-shipments.service.spec's).
    {
      branchScope: () => Promise.resolve({ all: true }),
    } as unknown as AccessControlService,
  );
  return { store, shipments, admin };
}

async function expectInvalidState(promise: Promise<unknown>): Promise<void> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(InvalidShipmentStateException);
  const exception = error as InvalidShipmentStateException;
  expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
  expect(exception.code).toBe(ShipmentErrorCodes.InvalidShipmentState);
}

const futureCard = (): SubmitPaymentDto['card'] => ({
  holderName: 'Maria Test',
  last4: '4242',
  expMonth: 12,
  expYear: new Date().getFullYear() + 2,
});

const payment = (): SubmitPaymentDto => ({ quantity: 2, card: futureCard() });

const offerDto = (): CreateOfferDto => ({
  supplierName: '  Shenzhen Gadget Co. ',
  unitPrice: 24.9,
  currency: 'usd',
});

const confirmDto = (): ConfirmPaymentDto => ({
  sender: {
    name: 'Shenzhen Gadget Co.',
    street: '88 Huaqiang Rd',
    city: ' Shenzhen ',
    country: 'CN',
  },
  recipient: {
    name: 'Maria Test',
    street: '10 Rue de Rivoli',
    city: 'Paris',
    country: 'FR',
  },
  weightKg: 1.2,
});

const event = (status: ShipmentState): CreateEventDto =>
  ({ status, location: 'Hub' }) as CreateEventDto;

describe('ShipmentsService.transition', () => {
  it('moves the shipment and adds a timeline step', async () => {
    const { store, shipments } = setup();
    const row = store.seed(ShipmentState.PENDING_CLIENT_DECISION);
    const shipment = store.load(row.id);

    await shipments.transition(
      store.manager as unknown as EntityManager,
      shipment,
      {
        from: [ShipmentState.PENDING_CLIENT_DECISION],
        to: ShipmentState.PENDING_PAYMENT,
        location: 'Offer approved',
        actor: customerActor(CLIENT_ID),
      },
    );

    expect(row.status).toBe(ShipmentState.PENDING_PAYMENT);
    expect(shipment.status).toBe(ShipmentState.PENDING_PAYMENT);
    expect(store.events).toEqual([
      {
        shipmentId: row.id,
        status: ShipmentState.PENDING_PAYMENT,
        location: 'Offer approved',
        actorType: ShipmentActorType.CUSTOMER,
        actorId: CLIENT_ID,
      },
    ]);
  });

  it('puts the status check in the UPDATE itself, not only before it', async () => {
    const { store, shipments } = setup();
    const row = store.seed(ShipmentState.IN_TRANSIT);
    const from = [ShipmentState.CONFIRMED, ShipmentState.IN_TRANSIT];

    await shipments.transition(
      store.manager as unknown as EntityManager,
      store.load(row.id),
      {
        from,
        to: ShipmentState.IN_TRANSIT,
        location: 'Hub',
        actor: staffActor(STAFF_ID),
      },
    );

    expect(store.updates).toHaveLength(1);
    const [update] = store.updates;
    expect(update.params).toEqual({ id: row.id, from });
    expect(update.conditions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/status IN \(:\.\.\.from\)/),
      ]),
    );
  });

  it('sets extra columns in the same UPDATE, and they cannot override the status', async () => {
    const { store, shipments } = setup();
    const row = store.seed(ShipmentState.PENDING_PAYMENT_CONFIRMATION);

    await shipments.transition(
      store.manager as unknown as EntityManager,
      store.load(row.id),
      {
        from: [ShipmentState.PENDING_PAYMENT_CONFIRMATION],
        to: ShipmentState.CONFIRMED,
        location: 'Payment confirmed',
        actor: staffActor(STAFF_ID),
        changes: { origin: 'Shenzhen', status: ShipmentState.DELIVERED },
      },
    );

    expect(store.updates).toHaveLength(1);
    expect(row.origin).toBe('Shenzhen');
    expect(row.status).toBe(ShipmentState.CONFIRMED);
  });

  it('refuses a shipment that is not in a `from` status, without touching the database', async () => {
    const { store, shipments } = setup();
    const row = store.seed(ShipmentState.PENDING_SOURCING);

    await expectInvalidState(
      shipments.transition(
        store.manager as unknown as EntityManager,
        store.load(row.id),
        {
          from: [ShipmentState.PENDING_CLIENT_DECISION],
          to: ShipmentState.PENDING_PAYMENT,
          location: 'Offer approved',
          actor: customerActor(CLIENT_ID),
        },
      ),
    );

    expect(store.updates).toHaveLength(0);
    expect(store.events).toHaveLength(0);
    expect(row.status).toBe(ShipmentState.PENDING_SOURCING);
  });
});

describe('ShipmentsService.transition under concurrency', () => {
  it('refuses a stale copy: the row moved on after it was loaded', async () => {
    const { store, shipments } = setup();
    const row = store.seed(ShipmentState.PENDING_CLIENT_DECISION);
    const stale = store.load(row.id);
    row.status = ShipmentState.PENDING_PAYMENT; // someone else accepted meanwhile

    await expectInvalidState(
      shipments.transition(store.manager as unknown as EntityManager, stale, {
        from: [ShipmentState.PENDING_CLIENT_DECISION],
        to: ShipmentState.PENDING_SOURCING,
        location: 'Offer rejected',
        actor: customerActor(CLIENT_ID),
      }),
    );

    expect(store.updates).toHaveLength(1); // it tried, and the UPDATE matched nothing
    expect(row.status).toBe(ShipmentState.PENDING_PAYMENT);
    expect(stale.status).toBe(ShipmentState.PENDING_CLIENT_DECISION);
    expect(store.events).toHaveLength(0);
  });

  it('lets exactly one of two simultaneous transitions win', async () => {
    const { store, shipments } = setup();
    const row = store.seed(ShipmentState.PENDING_CLIENT_DECISION);
    const step = {
      from: [ShipmentState.PENDING_CLIENT_DECISION],
      to: ShipmentState.PENDING_PAYMENT,
      location: 'Offer approved',
      actor: customerActor(CLIENT_ID),
    };
    const manager = store.manager as unknown as EntityManager;

    const results = await Promise.allSettled([
      shipments.transition(manager, store.load(row.id), step),
      shipments.transition(manager, store.load(row.id), step),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const loser = results.find((result) => result.status === 'rejected');
    await expectInvalidState(
      Promise.reject((loser as PromiseRejectedResult).reason),
    );
    expect(store.events).toHaveLength(1);
    expect(row.status).toBe(ShipmentState.PENDING_PAYMENT);
  });

  it('a double-clicked Accept only moves the shipment once', async () => {
    const services = setup();
    const row = services.store.seed(ShipmentState.PENDING_CLIENT_DECISION);

    const results = await Promise.allSettled([
      services.shipments.acceptOffer(CLIENT_ID, TRACKING_ID),
      services.shipments.acceptOffer(CLIENT_ID, TRACKING_ID),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(row.status).toBe(ShipmentState.PENDING_PAYMENT);
    expect(services.store.events).toHaveLength(1);
  });

  it('two admins confirming the same payment only confirm it once', async () => {
    const services = setup();
    const row = services.store.seed(ShipmentState.PENDING_PAYMENT_CONFIRMATION);

    const results = await Promise.allSettled([
      services.admin.confirmPayment(STAFF_ID, TRACKING_ID, confirmDto()),
      services.admin.confirmPayment(STAFF_ID, TRACKING_ID, confirmDto()),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(row.status).toBe(ShipmentState.CONFIRMED);
    expect(services.store.events).toHaveLength(1);
  });
});

/** Every action, tried from every status: allowed only from the listed ones. */
type Action = {
  name: string;
  allowedFrom: ShipmentState[];
  to: ShipmentState;
  run: (services: ReturnType<typeof setup>) => Promise<unknown>;
};

const actions: Action[] = [
  {
    name: 'admin sends an offer',
    allowedFrom: [ShipmentState.PENDING_SOURCING],
    to: ShipmentState.PENDING_CLIENT_DECISION,
    run: ({ admin }) =>
      admin.createOffer(STAFF_ID, TRACKING_ID, offerDto(), []),
  },
  {
    name: 'client accepts the offer',
    allowedFrom: [ShipmentState.PENDING_CLIENT_DECISION],
    to: ShipmentState.PENDING_PAYMENT,
    run: ({ shipments }) => shipments.acceptOffer(CLIENT_ID, TRACKING_ID),
  },
  {
    name: 'client rejects the offer',
    allowedFrom: [ShipmentState.PENDING_CLIENT_DECISION],
    to: ShipmentState.PENDING_SOURCING,
    run: ({ shipments }) => shipments.rejectOffer(CLIENT_ID, TRACKING_ID),
  },
  {
    name: 'client pays',
    allowedFrom: [ShipmentState.PENDING_PAYMENT],
    to: ShipmentState.PENDING_PAYMENT_CONFIRMATION,
    run: ({ shipments }) =>
      shipments.submitPayment(CLIENT_ID, TRACKING_ID, payment()),
  },
  {
    name: 'admin confirms the payment',
    allowedFrom: [ShipmentState.PENDING_PAYMENT_CONFIRMATION],
    to: ShipmentState.CONFIRMED,
    run: ({ admin }) =>
      admin.confirmPayment(STAFF_ID, TRACKING_ID, confirmDto()),
  },
  // Written out here on purpose rather than read from TRACKING_TRANSITIONS,
  // so an accidental change to that table fails this test.
  {
    name: 'tracking event: in_transit',
    allowedFrom: [
      ShipmentState.CONFIRMED,
      ShipmentState.IN_TRANSIT,
      ShipmentState.OUT_FOR_DELIVERY,
    ],
    to: ShipmentState.IN_TRANSIT,
    run: ({ admin }) =>
      admin.addEvent(STAFF_ID, TRACKING_ID, event(ShipmentState.IN_TRANSIT)),
  },
  {
    name: 'tracking event: out_for_delivery',
    allowedFrom: [ShipmentState.IN_TRANSIT],
    to: ShipmentState.OUT_FOR_DELIVERY,
    run: ({ admin }) =>
      admin.addEvent(
        STAFF_ID,
        TRACKING_ID,
        event(ShipmentState.OUT_FOR_DELIVERY),
      ),
  },
  {
    name: 'tracking event: delivered',
    allowedFrom: [ShipmentState.OUT_FOR_DELIVERY],
    to: ShipmentState.DELIVERED,
    run: ({ admin }) =>
      admin.addEvent(STAFF_ID, TRACKING_ID, event(ShipmentState.DELIVERED)),
  },
  {
    name: 'tracking event: cancelled',
    allowedFrom: [
      ShipmentState.PENDING_SOURCING,
      ShipmentState.PENDING_CLIENT_DECISION,
      ShipmentState.PENDING_PAYMENT,
      ShipmentState.PENDING_PAYMENT_CONFIRMATION,
      ShipmentState.CONFIRMED,
      ShipmentState.IN_TRANSIT,
      ShipmentState.OUT_FOR_DELIVERY,
    ],
    to: ShipmentState.CANCELLED,
    run: ({ admin }) =>
      admin.addEvent(STAFF_ID, TRACKING_ID, event(ShipmentState.CANCELLED)),
  },
];
describe('allowed transitions', () => {
  describe.each(actions)('$name', ({ allowedFrom, to, run }) => {
    it.each(allowedFrom)('works from %s', async (from) => {
      const services = setup();
      const row = services.store.seed(from);

      await run(services);

      expect(row.status).toBe(to);
      expect(services.store.events).toEqual([
        expect.objectContaining({ shipmentId: row.id, status: to }),
      ]);
    });

    const refusedFrom = ALL_STATES.filter(
      (state) => !allowedFrom.includes(state),
    );
    it.each(refusedFrom)('is refused from %s', async (from) => {
      const services = setup();
      const row = services.store.seed(from);

      await expectInvalidState(run(services));

      expect(row.status).toBe(from);
      expect(services.store.events).toHaveLength(0);
    });
  });

  it.each([
    ShipmentState.PENDING_SOURCING,
    ShipmentState.PENDING_PAYMENT,
    ShipmentState.CONFIRMED,
    ShipmentState.REQUESTED,
  ])(
    'refuses %s as a tracking event, whatever the current status',
    async (status) => {
      for (const from of ALL_STATES) {
        const services = setup();
        const row = services.store.seed(from);
        await expectInvalidState(
          services.admin.addEvent(STAFF_ID, TRACKING_ID, event(status)),
        );
        expect(row.status).toBe(from);
      }
    },
  );
});

describe('what each transition records', () => {
  it('rejecting an offer keeps it as history, marked rejected', async () => {
    const { store, shipments } = setup();
    const row = store.seed(ShipmentState.PENDING_CLIENT_DECISION);

    const detail = await shipments.rejectOffer(CLIENT_ID, TRACKING_ID);

    expect(row.offers).toHaveLength(1);
    expect(row.offers[0].rejectedAt).toBeInstanceOf(Date);
    expect(detail.offer).toBeNull();
  });

  it('paying records the total from the open offer', async () => {
    const { store, shipments } = setup();
    const row = store.seed(ShipmentState.PENDING_PAYMENT);

    await shipments.submitPayment(CLIENT_ID, TRACKING_ID, payment());

    expect(row.payment).toMatchObject({
      quantity: 2,
      totalAmount: 49.8,
      currency: 'USD',
      cardLast4: '4242',
    });
  });

  it('confirming the payment sets the route and weight', async () => {
    const { store, admin } = setup();
    const row = store.seed(ShipmentState.PENDING_PAYMENT_CONFIRMATION);

    await admin.confirmPayment(STAFF_ID, TRACKING_ID, confirmDto());

    expect(row).toMatchObject({
      origin: 'Shenzhen',
      destination: 'Paris',
      weightKg: 1.2,
    });
  });
});

describe('a shipment from request to delivery', () => {
  it('goes through every stage in order, one timeline step each', async () => {
    const { store, shipments, admin } = setup();

    const created = await shipments.create(
      CLIENT_ID,
      { productUrl: 'https://shop.example.com/item' },
      [],
    );
    // create() picks a random tracking ID; the rest of the flow uses it.
    const trackingId = created.trackingId;
    await admin.createOffer(STAFF_ID, trackingId, offerDto(), []);
    await shipments.rejectOffer(CLIENT_ID, trackingId);
    await admin.createOffer(STAFF_ID, trackingId, offerDto(), []);
    await shipments.acceptOffer(CLIENT_ID, trackingId);
    await shipments.submitPayment(CLIENT_ID, trackingId, payment());
    await admin.confirmPayment(STAFF_ID, trackingId, confirmDto());
    await admin.addEvent(STAFF_ID, trackingId, event(ShipmentState.IN_TRANSIT));
    await admin.addEvent(STAFF_ID, trackingId, event(ShipmentState.IN_TRANSIT));
    await admin.addEvent(
      STAFF_ID,
      trackingId,
      event(ShipmentState.OUT_FOR_DELIVERY),
    );
    await admin.addEvent(STAFF_ID, trackingId, event(ShipmentState.DELIVERED));

    expect(store.events.map((step) => step.status)).toEqual([
      ShipmentState.PENDING_SOURCING,
      ShipmentState.PENDING_CLIENT_DECISION,
      ShipmentState.PENDING_SOURCING,
      ShipmentState.PENDING_CLIENT_DECISION,
      ShipmentState.PENDING_PAYMENT,
      ShipmentState.PENDING_PAYMENT_CONFIRMATION,
      ShipmentState.CONFIRMED,
      ShipmentState.IN_TRANSIT,
      ShipmentState.IN_TRANSIT,
      ShipmentState.OUT_FOR_DELIVERY,
      ShipmentState.DELIVERED,
    ]);
    // Each step records who took it: the client for theirs, the staff member for the rest.
    const client = {
      actorType: ShipmentActorType.CUSTOMER,
      actorId: CLIENT_ID,
    };
    const staff = { actorType: ShipmentActorType.STAFF, actorId: STAFF_ID };
    expect(
      store.events.map(({ actorType, actorId }) => ({ actorType, actorId })),
    ).toEqual([
      client,
      staff,
      client,
      staff,
      client,
      client,
      staff,
      staff,
      staff,
      staff,
      staff,
    ]);
    const [row] = store.rows.values();
    expect(row.status).toBe(ShipmentState.DELIVERED);

    // Delivered is final: nothing moves it again.
    await expectInvalidState(
      admin.addEvent(STAFF_ID, trackingId, event(ShipmentState.CANCELLED)),
    );
  });
});
