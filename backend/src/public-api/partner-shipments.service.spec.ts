import { HttpStatus } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  ShipmentState,
  TRACKING_TRANSITIONS,
} from '../shipments/constants/shipment-state';
import { Shipment } from '../shipments/entities/shipment.entity';
import { ShipmentEvent } from '../shipments/entities/shipment-event.entity';
import { ShipmentsService } from '../shipments/shipments.service';
import { ShipmentErrorCodes } from '../shipments/exceptions';
import { User } from '../users/user.entity';
import { DomainException } from '../common/exceptions/base/error-types';
import { PartnerShipmentsService } from './partner-shipments.service';
import { PartnerContext } from './types/partner-context';
import { PublicApiErrorCodes } from './exceptions';
import { CreatePartnerShipmentDto } from './dto/create-partner-shipment.dto';

const partner: PartnerContext = {
  id: 'key-1',
  name: 'Carrier sync',
  organizationId: 'org-lyon',
  organizationName: 'Lyon',
  isInternal: false,
};

const customer = {
  id: 'user-1',
  name: 'Amina El Idrissi',
  email: 'amina@example.com',
  isActive: true,
} as User;

const address = (city: string) => ({
  name: 'Someone',
  street: '1 Rue X',
  city,
  country: 'FR',
});

function shipmentRow(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 'ship-1',
    trackingId: 'TRK-ABC123',
    clientId: customer.id,
    client: customer,
    organizationId: partner.organizationId,
    status: ShipmentState.IN_TRANSIT,
    origin: 'Lyon',
    destination: 'Paris',
    sender: address('Lyon'),
    recipient: address('Paris'),
    weightKg: 1.5,
    createdAt: new Date('2026-10-20T10:00:00Z'),
    updatedAt: new Date('2026-10-21T10:00:00Z'),
    ...overrides,
  } as Shipment;
}

function setup({
  users = [customer],
  shipments = [shipmentRow()],
}: { users?: User[]; shipments?: Shipment[] } = {}) {
  const saved: Partial<Shipment>[] = [];
  const insertedEvents: Partial<ShipmentEvent>[] = [];
  const manager = {
    create: (_entity: unknown, values: Partial<Shipment>) => values,
    // Set below, once the shipments it adds to exist.
    save: jest.fn(),
    insert: jest.fn((_entity: unknown, values: Partial<ShipmentEvent>) => {
      insertedEvents.push(values);
      return Promise.resolve();
    }),
  };
  const dataSource = {
    transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  } as unknown as DataSource;

  // findOne the way TypeORM would answer it for these where clauses.
  const shipmentRepository = {
    findOne: jest.fn(
      ({ where }: { where: { trackingId: string; organizationId: string } }) =>
        Promise.resolve(
          shipments.find(
            (row) =>
              row.trackingId === where.trackingId &&
              row.organizationId === where.organizationId,
          ) ?? null,
        ),
    ),
  } as unknown as Repository<Shipment>;
  const userRepository = {
    findOne: jest.fn(({ where }: { where: { email: string } }) =>
      Promise.resolve(users.find((user) => user.email === where.email) ?? null),
    ),
  } as unknown as Repository<User>;

  const shipmentsService = {
    generateTrackingId: jest.fn().mockResolvedValue('TRK-NEW001'),
    listEvents: jest
      .fn()
      .mockResolvedValue([
        { status: 'in_transit', location: 'Lyon hub', occurredAt: new Date() },
      ]),
    transition: jest.fn().mockResolvedValue(undefined),
  };

  const service = new PartnerShipmentsService(
    shipmentRepository,
    userRepository,
    shipmentsService as unknown as ShipmentsService,
    dataSource,
  );
  // create() reads the new shipment back through get(): it exists from then on.
  manager.save.mockImplementation((values: Partial<Shipment>) => {
    saved.push(values);
    shipments.push(shipmentRow({ ...values, client: customer } as Shipment));
    return Promise.resolve({ ...values, id: 'ship-new' });
  });

  return { service, saved, insertedEvents, shipmentsService };
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    const exception = error as DomainException;
    return { status: exception.getStatus(), code: exception.code };
  }
  throw new Error('Expected it to fail');
}

const createDto = (
  overrides: Partial<CreatePartnerShipmentDto> = {},
): CreatePartnerShipmentDto => ({
  customerEmail: ' Amina@Example.com ',
  sender: address(' Lyon '),
  recipient: address(' Paris '),
  weightKg: 2.25,
  ...overrides,
});

describe('PartnerShipmentsService: reaching a shipment', () => {
  it("returns its branch's shipment with its timeline and customer", async () => {
    const { service } = setup();
    const detail = await service.get(partner, ' trk-abc123 ');
    expect(detail).toMatchObject({
      trackingId: 'TRK-ABC123',
      customer: { email: 'amina@example.com' },
      weightKg: 1.5,
      events: [{ status: 'in_transit', location: 'Lyon hub' }],
    });
  });

  it("is a 404 (3001) for another branch's shipment, or one no branch holds, and changes nothing", async () => {
    const { service, shipmentsService } = setup({
      shipments: [
        shipmentRow({ trackingId: 'TRK-OTHER1', organizationId: 'org-paris' }),
        shipmentRow({ trackingId: 'TRK-CLIENT', organizationId: null }),
      ],
    });
    for (const trackingId of ['TRK-OTHER1', 'TRK-CLIENT', 'TRK-NOPE00']) {
      expect(await codeOf(service.get(partner, trackingId))).toEqual({
        status: HttpStatus.NOT_FOUND,
        code: ShipmentErrorCodes.ShipmentNotFound,
      });
      await expect(
        service.updateStatus(partner, trackingId, {
          status: ShipmentState.DELIVERED,
          location: 'X',
        }),
      ).rejects.toThrow();
      await expect(service.cancel(partner, trackingId)).rejects.toThrow();
    }
    expect(shipmentsService.transition).not.toHaveBeenCalled();
  });
});

describe('PartnerShipmentsService.create', () => {
  it('creates it at confirmed, for the customer, in the key’s branch, with its first timeline step', async () => {
    const { service, saved, insertedEvents } = setup();

    const detail = await service.create(partner, createDto());

    expect(saved).toEqual([
      expect.objectContaining({
        trackingId: 'TRK-NEW001',
        clientId: 'user-1',
        organizationId: 'org-lyon',
        status: ShipmentState.CONFIRMED,
        productUrl: null,
        origin: 'Lyon',
        destination: 'Paris',
        weightKg: 2.25,
      }),
    ]);
    expect(insertedEvents).toEqual([
      {
        shipmentId: 'ship-new',
        status: ShipmentState.CONFIRMED,
        location: 'Created by Lyon',
      },
    ]);
    expect(detail.trackingId).toBe('TRK-NEW001');
  });

  it('is a 404 (16008) for an unknown or deactivated customer, and creates nothing', async () => {
    const { service, saved } = setup({
      users: [
        { ...customer, email: 'gone@example.com', isActive: false } as User,
      ],
    });
    for (const customerEmail of ['nobody@example.com', 'gone@example.com']) {
      expect(
        await codeOf(service.create(partner, createDto({ customerEmail }))),
      ).toEqual({
        status: HttpStatus.NOT_FOUND,
        code: PublicApiErrorCodes.PartnerCustomerNotFound,
      });
    }
    expect(saved).toEqual([]);
  });
});

describe('PartnerShipmentsService: status changes', () => {
  it('a tracking update takes the same allowed moves as the admin’s', async () => {
    const { service, shipmentsService } = setup();
    await service.updateStatus(partner, 'TRK-ABC123', {
      status: ShipmentState.OUT_FOR_DELIVERY,
      location: '  Paris depot ',
    });
    expect(shipmentsService.transition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ trackingId: 'TRK-ABC123' }),
      {
        from: TRACKING_TRANSITIONS[ShipmentState.OUT_FOR_DELIVERY],
        to: ShipmentState.OUT_FOR_DELIVERY,
        location: 'Paris depot',
      },
    );
  });

  it('a cancellation says why, or who by', async () => {
    const { service, shipmentsService } = setup();
    await service.cancel(partner, 'TRK-ABC123', '  Customer refused it ');
    await service.cancel(partner, 'TRK-ABC123');

    const steps = shipmentsService.transition.mock.calls.map(
      (call: unknown[]) => call[2],
    );
    expect(steps).toEqual([
      {
        from: TRACKING_TRANSITIONS[ShipmentState.CANCELLED],
        to: ShipmentState.CANCELLED,
        location: 'Customer refused it',
      },
      {
        from: TRACKING_TRANSITIONS[ShipmentState.CANCELLED],
        to: ShipmentState.CANCELLED,
        location: 'Cancelled by Lyon',
      },
    ]);
  });
});
