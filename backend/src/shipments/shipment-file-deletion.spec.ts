import { HttpStatus } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FileStorageService } from '../file-storage/file-storage.service';
import { ShipmentState, ShipmentFileKind } from './constants/shipment-state';
import { Shipment } from './entities/shipment.entity';
import { ShipmentEvent } from './entities/shipment-event.entity';
import { ShipmentFile } from './entities/shipment-file.entity';
import { DomainException } from '../common/exceptions/base/error-types';
import { ShipmentErrorCodes } from './exceptions';
import { ShipmentsService } from './shipments.service';

/**
 * The customer's own DELETE /shipments/:trackingId/files/:fileId — the rules
 * ShipmentsService.deleteOwnFile enforces on top of the row-removal mechanism
 * (already exercised, for the admin side, in admin-shipments.service.spec.ts).
 */

const CLIENT_ID = 'client-1';
const OTHER_CLIENT_ID = 'client-2';
const TRACKING_ID = 'TRK-ABC123';

interface StoredShipment {
  id: string;
  trackingId: string;
  clientId: string;
  status: ShipmentState;
  productUrl: string | null;
  files: ShipmentFile[];
}

class FakeStore {
  readonly rows = new Map<string, StoredShipment>();
  readonly deletedKeys: string[] = [];
  private nextId = 1;

  seed(
    overrides: Partial<StoredShipment> & { fileCount?: number } = {},
  ): StoredShipment {
    const id = `shipment-${this.nextId++}`;
    const row: StoredShipment = {
      id,
      trackingId: TRACKING_ID,
      clientId: CLIENT_ID,
      status: ShipmentState.PENDING_SOURCING,
      productUrl: null,
      files: [],
      ...overrides,
    };
    const fileCount = overrides.fileCount ?? 1;
    for (let i = 0; i < fileCount; i++) {
      row.files.push(
        Object.assign(new ShipmentFile(), {
          id: `file-${this.nextId++}`,
          shipmentId: id,
          offerId: null,
          kind: ShipmentFileKind.REQUEST_PHOTO,
          storageKey: `shipments/${TRACKING_ID}/req-${i}.jpg`,
          name: `req-${i}.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 100,
        }),
      );
    }
    this.rows.set(id, row);
    return row;
  }

  readonly shipmentRepository = {
    findOne: ({
      where,
    }: {
      where: { trackingId: string; clientId?: string };
    }): Promise<Shipment | null> => {
      const row = [...this.rows.values()].find(
        (r) =>
          r.trackingId === where.trackingId &&
          (where.clientId === undefined || r.clientId === where.clientId),
      );
      return Promise.resolve(row ? (row as unknown as Shipment) : null);
    },
  };

  readonly fileRepository = {
    findOne: ({
      where,
    }: {
      where: { id: string; shipmentId: string };
    }): Promise<ShipmentFile | null> => {
      const row = this.rows.get(where.shipmentId);
      return Promise.resolve(
        row?.files.find((f) => f.id === where.id) ?? null,
      );
    },
    count: ({
      where,
    }: {
      where: { shipmentId: string; kind: ShipmentFileKind };
    }): Promise<number> => {
      const row = this.rows.get(where.shipmentId);
      return Promise.resolve(
        row ? row.files.filter((f) => f.kind === where.kind).length : 0,
      );
    },
  };

  readonly manager = {
    remove: <T>(entity: T): Promise<T> => {
      if (entity instanceof ShipmentFile) {
        const row = this.rows.get(entity.shipmentId);
        if (row) {
          row.files = row.files.filter((f) => f.id !== entity.id);
        }
      }
      return Promise.resolve(entity);
    },
  };

  readonly dataSource = {
    transaction: <T>(work: (manager: EntityManager) => Promise<T>) =>
      work(this.manager as unknown as EntityManager),
  };

  readonly fileStorageService = {
    deleteFile: (key: string) => {
      this.deletedKeys.push(key);
      return Promise.resolve();
    },
  };
}

function setup() {
  const store = new FakeStore();
  const emptyRepository = { find: () => Promise.resolve([]) };
  const service = new ShipmentsService(
    store.shipmentRepository as unknown as Repository<Shipment>,
    emptyRepository as unknown as Repository<ShipmentEvent>,
    store.fileRepository as unknown as Repository<ShipmentFile>,
    store.dataSource as unknown as DataSource,
    store.fileStorageService as unknown as FileStorageService,
  );
  return { store, service };
}

async function expectError(
  promise: Promise<unknown>,
  status: HttpStatus,
  code: ShipmentErrorCodes,
): Promise<void> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(DomainException);
  expect((error as DomainException).getStatus()).toBe(status);
  expect((error as DomainException).code).toBe(code);
}

const expectNotFound = (promise: Promise<unknown>) =>
  expectError(
    promise,
    HttpStatus.NOT_FOUND,
    ShipmentErrorCodes.ShipmentFileNotFound,
  );
const expectNotDeletable = (promise: Promise<unknown>) =>
  expectError(
    promise,
    HttpStatus.CONFLICT,
    ShipmentErrorCodes.ShipmentFileNotDeletable,
  );

describe("ShipmentsService.deleteOwnFile (the customer's own request photos)", () => {
  it('removes a request photo while pending_sourcing, with a product link present', async () => {
    const { store, service } = setup();
    const row = store.seed({ productUrl: 'https://shop.example.com/item' });
    const target = row.files[0];

    await service.deleteOwnFile(CLIENT_ID, TRACKING_ID, target.id);

    expect(row.files).toHaveLength(0);
    expect(store.deletedKeys).toEqual([target.storageKey]);
  });

  it('removes one of several request photos even with no product link, as long as one remains', async () => {
    const { store, service } = setup();
    const row = store.seed({ productUrl: null, fileCount: 2 });
    const target = row.files[0];

    await service.deleteOwnFile(CLIENT_ID, TRACKING_ID, target.id);

    expect(row.files).toHaveLength(1);
  });

  it('refuses to remove the last request photo when there is no product link (409, 3007)', async () => {
    const { store, service } = setup();
    const row = store.seed({ productUrl: null, fileCount: 1 });
    const target = row.files[0];

    await expectNotDeletable(
      service.deleteOwnFile(CLIENT_ID, TRACKING_ID, target.id),
    );

    expect(row.files).toHaveLength(1);
  });

  it('refuses once the shipment has moved past pending_sourcing (409, 3007)', async () => {
    const { store, service } = setup();
    const row = store.seed({
      status: ShipmentState.PENDING_CLIENT_DECISION,
      productUrl: 'https://shop.example.com/item',
    });
    const target = row.files[0];

    await expectNotDeletable(
      service.deleteOwnFile(CLIENT_ID, TRACKING_ID, target.id),
    );

    expect(row.files).toHaveLength(1);
  });

  it("refuses to remove an offer photo through this endpoint (404, as if it didn't exist)", async () => {
    const { store, service } = setup();
    const row = store.seed({ productUrl: 'https://shop.example.com/item' });
    const offerPhoto = Object.assign(new ShipmentFile(), {
      id: 'offer-photo-1',
      shipmentId: row.id,
      offerId: 'offer-1',
      kind: ShipmentFileKind.OFFER_PHOTO,
      storageKey: `shipments/${TRACKING_ID}/offer.jpg`,
      name: 'offer.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
    });
    row.files.push(offerPhoto);

    await expectNotFound(
      service.deleteOwnFile(CLIENT_ID, TRACKING_ID, offerPhoto.id),
    );

    expect(row.files).toContain(offerPhoto);
  });

  it('a file id that does not exist is a 404 (3006)', async () => {
    const { store, service } = setup();
    store.seed({ productUrl: 'https://shop.example.com/item' });

    await expectNotFound(
      service.deleteOwnFile(CLIENT_ID, TRACKING_ID, 'nope'),
    );
  });

  it("another client's shipment is a 404, never revealing it exists", async () => {
    const { store, service } = setup();
    const row = store.seed({ productUrl: 'https://shop.example.com/item' });

    await expectError(
      service.deleteOwnFile(OTHER_CLIENT_ID, TRACKING_ID, row.files[0].id),
      HttpStatus.NOT_FOUND,
      ShipmentErrorCodes.ShipmentNotFound,
    );
  });
});
