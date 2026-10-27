import { HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ACCESS_CONTROL_KEYS } from '../common/decorators/access-control.decorator';
import { DomainException } from '../common/exceptions/base/error-types';
import { FileStorageErrorCodes } from '../file-storage/exceptions/file-storage-exceptions';
import { FileStorageService } from '../file-storage/file-storage.service';
import { StorageProvider } from '../file-storage/interfaces/storage-provider.interface';
import { User } from '../users/user.entity';
import { AdminShipmentsController } from './admin-shipments.controller';
import { AdminShipmentsService } from './admin-shipments.service';
import {
  ATTACHMENT_KINDS,
  MAX_REQUEST_IMAGES,
  ShipmentFileKind,
  ShipmentState,
} from './constants/shipment-state';
import { ShipmentActorType } from './constants/shipment-actor';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { Shipment } from './entities/shipment.entity';
import { ShipmentEvent } from './entities/shipment-event.entity';
import { ShipmentFile } from './entities/shipment-file.entity';
import { ShipmentOffer } from './entities/shipment-offer.entity';
import { ShipmentErrorCodes } from './exceptions';
import { ShipmentsService } from './shipments.service';

/**
 * Real magic-byte signatures — FileStorageService now sniffs the actual
 * bytes, so a fixture's declared `mimetype` no longer drives validation; only
 * these bytes do.
 */
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PDF_BYTES = Buffer.from('%PDF-1.4\n%fake', 'ascii');
/** Matches no known signature — stands in for any unsupported real file type. */
const UNKNOWN_BYTES = Buffer.from('this is not a recognized file signature');

function padded(signature: Buffer, size: number): Buffer {
  const buffer = Buffer.alloc(size);
  signature.copy(buffer);
  return buffer;
}

/**
 * The business logic each admin action adds on top of the status-transition
 * mechanism — which shipment-transitions.spec.ts already covers end to end
 * (the `UPDATE ... WHERE status IN (:from)` guard, and which `from` states
 * each action allows). This file is about everything else: DTO validation,
 * file-type/size rules, what gets persisted, upload cleanup on failure, and
 * which permission each route requires.
 *
 * Runs the real AdminShipmentsService, ShipmentsService and FileStorageService
 * (so file-type/size validation and storage-key generation are the real
 * code), against an in-memory shipment store and an in-memory StorageProvider.
 */

const CLIENT_ID = 'client-1';
const TRACKING_ID = 'TRK-ABC123';
const STAFF_ID = 'staff-1';
const CLIENT = Object.assign(new User(), {
  id: CLIENT_ID,
  name: 'Maria Test',
  email: 'client@test.com',
});

type StoredShipment = Shipment & {
  offers: ShipmentOffer[];
  files: ShipmentFile[];
};

class FakeStorageProvider implements StorageProvider {
  readonly uploads: { key: string; buffer: Buffer; contentType: string }[] = [];
  readonly deleted: string[] = [];

  uploadFile(buffer: Buffer, key: string, options: { contentType: string }) {
    this.uploads.push({ key, buffer, contentType: options.contentType });
    return Promise.resolve({ key, bucket: 'test-bucket' });
  }

  deleteFile(key: string): Promise<void> {
    this.deleted.push(key);
    return Promise.resolve();
  }

  getSignedUrl(key: string): Promise<string> {
    return Promise.resolve(`https://signed/${key}`);
  }

  fileExists(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class FakeShipmentStore {
  readonly rows = new Map<string, StoredShipment>();
  readonly events: Pick<ShipmentEvent, 'shipmentId' | 'status' | 'location'>[] =
    [];
  /** Set to make the next ShipmentOffer save blow up, to test upload cleanup. */
  failOfferSave = false;
  private nextId = 1;

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
      sender: null,
      recipient: null,
      weightKg: null,
      offers: [] as ShipmentOffer[],
      files: [] as ShipmentFile[],
      payment: null,
      updatedAt: new Date(),
    });
    this.rows.set(shipment.id, shipment);
    return shipment;
  }

  seedFile(
    shipmentId: string,
    overrides: Partial<ShipmentFile> = {},
  ): ShipmentFile {
    const file = Object.assign(new ShipmentFile(), {
      id: `file-${this.nextId++}`,
      shipmentId,
      offerId: null,
      kind: ShipmentFileKind.OTHER,
      storageKey: `shipments/${TRACKING_ID}/seed-${this.nextId}.jpg`,
      name: 'seed.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      createdAt: new Date(),
      ...overrides,
    });
    this.rows.get(shipmentId)!.files.push(file);
    return file;
  }

  /** Backs the ShipmentFile repository injected into ShipmentsService. */
  readonly fileRepository = {
    findOne: ({
      where,
    }: {
      where: { id: string; shipmentId: string };
    }): Promise<ShipmentFile | null> => {
      const row = this.rows.get(where.shipmentId);
      return Promise.resolve(
        row?.files.find((candidate) => candidate.id === where.id) ?? null,
      );
    },
  };

  /** What a fresh SELECT returns: a separate copy, so it can go stale. */
  load(id: string): Shipment {
    const row = this.rows.get(id)!;
    return Object.assign(new Shipment(), {
      ...row,
      offers: row.offers.map((offer) => ({ ...offer })),
      files: row.files.map((file) => ({ ...file })),
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
  };

  readonly manager = {
    createQueryBuilder: () => {
      const update: {
        set: Record<string, unknown>;
        params: { id?: string; from?: ShipmentState[] };
      } = { set: {}, params: {} };
      const builder = {
        update: () => builder,
        set: (values: Record<string, unknown>) => {
          update.set = values;
          return builder;
        },
        where: (_condition: string, params: typeof update.params) => {
          Object.assign(update.params, params);
          return builder;
        },
        andWhere: (condition: string, params: typeof update.params) =>
          builder.where(condition, params),
        execute: async () => {
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
      }
      return Promise.resolve();
    },
    create: <T extends object>(entity: new () => T, values: Partial<T>): T =>
      Object.assign(new entity(), values),
    save: <T>(entityOrArray: T): Promise<T> => {
      if (Array.isArray(entityOrArray)) {
        return Promise.all(
          entityOrArray.map((item) => this.manager.save(item)),
        ) as unknown as Promise<T>;
      }
      const entity = entityOrArray as unknown;
      if (entity instanceof ShipmentOffer) {
        if (this.failOfferSave) {
          return Promise.reject(new Error('db exploded'));
        }
        Object.assign(entity, {
          id: `offer-${this.nextId++}`,
          createdAt: new Date(),
          rejectedAt: null,
        });
        this.rows.get(entity.shipmentId)!.offers.push(entity);
      } else if (entity instanceof ShipmentFile) {
        Object.assign(entity, {
          id: `file-${this.nextId++}`,
          createdAt: new Date(),
        });
        this.rows.get(entity.shipmentId)!.files.push(entity);
      }
      return Promise.resolve(entityOrArray);
    },
    remove: <T>(entity: T): Promise<T> => {
      if (entity instanceof ShipmentFile) {
        const row = this.rows.get(entity.shipmentId);
        if (row) {
          row.files = row.files.filter(
            (candidate) => candidate.id !== entity.id,
          );
        }
      }
      return Promise.resolve(entity);
    },
  };

  readonly dataSource = {
    transaction: <T>(work: (manager: EntityManager) => Promise<T>) =>
      work(this.manager as unknown as EntityManager),
  };
}

function setup() {
  const store = new FakeShipmentStore();
  const provider = new FakeStorageProvider();
  const fileStorage = new FileStorageService(provider);
  const emptyRepository = { find: () => Promise.resolve([]) };
  const shipments = new ShipmentsService(
    store.repository as unknown as Repository<Shipment>,
    emptyRepository as unknown as Repository<ShipmentEvent>,
    store.fileRepository as unknown as Repository<ShipmentFile>,
    store.dataSource as unknown as DataSource,
    fileStorage,
  );
  const admin = new AdminShipmentsService(
    shipments,
    store.dataSource as unknown as DataSource,
  );
  return { store, admin, provider };
}

function file(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'images',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: JPEG_BYTES,
    size: 17,
    ...overrides,
  } as Express.Multer.File;
}

const offerDto = (overrides: Partial<CreateOfferDto> = {}): CreateOfferDto => ({
  supplierName: 'Shenzhen Gadget Co.',
  unitPrice: 24.9,
  currency: 'USD',
  ...overrides,
});

const address = (overrides: Partial<ConfirmPaymentDto['sender']> = {}) => ({
  name: 'Maria Test',
  street: '10 Rue de Rivoli',
  city: 'Paris',
  country: 'FR',
  ...overrides,
});

const confirmDto = (
  overrides: Partial<ConfirmPaymentDto> = {},
): ConfirmPaymentDto => ({
  sender: address({
    name: 'Shenzhen Gadget Co.',
    street: '88 Huaqiang Rd',
    city: ' Shenzhen ',
    country: 'CN',
  }),
  recipient: address(),
  weightKg: 1.2,
  ...overrides,
});

async function expectDomainError(
  promise: Promise<unknown>,
  status: HttpStatus,
  code: number,
): Promise<void> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(DomainException);
  expect((error as DomainException).getStatus()).toBe(status);
  expect((error as DomainException).code).toBe(code);
}

const expectTooManyImages = (promise: Promise<unknown>) =>
  expectDomainError(
    promise,
    HttpStatus.BAD_REQUEST,
    ShipmentErrorCodes.TooManyImages,
  );
const expectInvalidFileType = (promise: Promise<unknown>) =>
  expectDomainError(
    promise,
    HttpStatus.BAD_REQUEST,
    FileStorageErrorCodes.InvalidFileType,
  );
const expectFileTooLarge = (promise: Promise<unknown>) =>
  expectDomainError(
    promise,
    HttpStatus.BAD_REQUEST,
    FileStorageErrorCodes.FileTooLarge,
  );
const expectInvalidState = (promise: Promise<unknown>) =>
  expectDomainError(
    promise,
    HttpStatus.CONFLICT,
    ShipmentErrorCodes.InvalidShipmentState,
  );
const expectFileNotFound = (promise: Promise<unknown>) =>
  expectDomainError(
    promise,
    HttpStatus.NOT_FOUND,
    ShipmentErrorCodes.ShipmentFileNotFound,
  );
const expectFileNotDeletable = (promise: Promise<unknown>) =>
  expectDomainError(
    promise,
    HttpStatus.CONFLICT,
    ShipmentErrorCodes.ShipmentFileNotDeletable,
  );

/** Runs class-validator the way the global ValidationPipe would. */
async function errorsFor<T extends object>(
  cls: new () => T,
  plain: object,
): Promise<ValidationError[]> {
  return validate(plainToInstance(cls, plain));
}
const hasErrorOn = (errors: ValidationError[], property: string) =>
  errors.some((error) => error.property === property);

describe('CreateOfferDto validation', () => {
  const valid = () => ({
    supplierName: 'Shenzhen Gadget Co.',
    unitPrice: 24.9,
    currency: 'USD',
  });

  it('accepts a minimal valid offer', async () => {
    expect(await errorsFor(CreateOfferDto, valid())).toHaveLength(0);
  });

  it.each([
    ['blank', ''],
    ['missing', undefined],
    ['over 200 characters', 'x'.repeat(201)],
  ])('rejects a supplier name that is %s', async (_label, supplierName) => {
    const errors = await errorsFor(CreateOfferDto, {
      ...valid(),
      supplierName,
    });
    expect(hasErrorOn(errors, 'supplierName')).toBe(true);
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['over the 1,000,000 cap', 1_000_001],
    ['more than 2 decimal places', 24.999],
    ['missing', undefined],
  ])('rejects a unit price that is %s', async (_label, unitPrice) => {
    const errors = await errorsFor(CreateOfferDto, { ...valid(), unitPrice });
    expect(hasErrorOn(errors, 'unitPrice')).toBe(true);
  });

  it.each([
    ['not a real currency code', 'ZZZ'],
    ['missing', undefined],
  ])('rejects a currency that is %s', async (_label, currency) => {
    const errors = await errorsFor(CreateOfferDto, { ...valid(), currency });
    expect(hasErrorOn(errors, 'currency')).toBe(true);
  });

  it('accepts a lowercase currency code (the service upper-cases it)', async () => {
    const errors = await errorsFor(CreateOfferDto, {
      ...valid(),
      currency: 'usd',
    });
    expect(hasErrorOn(errors, 'currency')).toBe(false);
  });
});

describe('ConfirmPaymentDto validation', () => {
  const valid = () => ({
    sender: address(),
    recipient: address(),
    weightKg: 1.2,
  });

  it('accepts a minimal valid payload', async () => {
    expect(await errorsFor(ConfirmPaymentDto, valid())).toHaveLength(0);
  });

  it.each(['name', 'street', 'city'])(
    'rejects a sender missing %s',
    async (field) => {
      const errors = await errorsFor(ConfirmPaymentDto, {
        ...valid(),
        sender: { ...address(), [field]: '' },
      });
      expect(hasErrorOn(errors, 'sender')).toBe(true);
    },
  );

  it('rejects a country that is not ISO 3166-1 alpha-2', async () => {
    const errors = await errorsFor(ConfirmPaymentDto, {
      ...valid(),
      recipient: address({ country: 'France' }),
    });
    expect(hasErrorOn(errors, 'recipient')).toBe(true);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['over the 100,000 kg cap', 100_001],
    ['missing', undefined],
  ])('rejects a weight that is %s', async (_label, weightKg) => {
    const errors = await errorsFor(ConfirmPaymentDto, { ...valid(), weightKg });
    expect(hasErrorOn(errors, 'weightKg')).toBe(true);
  });
});

describe('CreateEventDto validation', () => {
  it.each([
    ShipmentState.IN_TRANSIT,
    ShipmentState.OUT_FOR_DELIVERY,
    ShipmentState.DELIVERED,
    ShipmentState.CANCELLED,
  ])('accepts %s as a tracking status', async (status) => {
    const errors = await errorsFor(CreateEventDto, { status, location: 'Hub' });
    expect(errors).toHaveLength(0);
  });

  it.each([
    ShipmentState.PENDING_SOURCING,
    ShipmentState.PENDING_CLIENT_DECISION,
    ShipmentState.PENDING_PAYMENT,
    ShipmentState.PENDING_PAYMENT_CONFIRMATION,
    ShipmentState.CONFIRMED,
    ShipmentState.REQUESTED,
  ])(
    'rejects %s: not a status an admin posts directly as a tracking event',
    async (status) => {
      const errors = await errorsFor(CreateEventDto, {
        status,
        location: 'Hub',
      });
      expect(hasErrorOn(errors, 'status')).toBe(true);
    },
  );

  it('rejects a blank location', async () => {
    const errors = await errorsFor(CreateEventDto, {
      status: ShipmentState.IN_TRANSIT,
      location: '',
    });
    expect(hasErrorOn(errors, 'location')).toBe(true);
  });
});

describe('UploadFileDto validation', () => {
  it.each(ATTACHMENT_KINDS)('accepts %s', async (kind) => {
    expect(await errorsFor(UploadFileDto, { kind })).toHaveLength(0);
  });

  it.each([
    ['the request-photo kind', ShipmentFileKind.REQUEST_PHOTO],
    ['the offer-photo kind', ShipmentFileKind.OFFER_PHOTO],
    ['garbage', 'not_a_kind'],
    ['missing', undefined],
  ])('rejects %s: not one of the Files-tab kinds', async (_label, kind) => {
    const errors = await errorsFor(UploadFileDto, { kind });
    expect(hasErrorOn(errors, 'kind')).toBe(true);
  });
});

describe('sending an offer', () => {
  it('is refused outside pending_sourcing, and nothing is uploaded', async () => {
    const { store, admin, provider } = setup();
    const row = store.seed(ShipmentState.PENDING_CLIENT_DECISION);

    await expectInvalidState(
      admin.createOffer(STAFF_ID, TRACKING_ID, offerDto(), [file()]),
    );

    expect(provider.uploads).toHaveLength(0);
    expect(row.offers).toHaveLength(0);
  });

  it('refuses more than 5 photos, before anything is uploaded', async () => {
    const { store, admin, provider } = setup();
    store.seed(ShipmentState.PENDING_SOURCING);
    const images = Array.from({ length: MAX_REQUEST_IMAGES + 1 }, () => file());

    await expectTooManyImages(
      admin.createOffer(STAFF_ID, TRACKING_ID, offerDto(), images),
    );

    expect(provider.uploads).toHaveLength(0);
  });

  it('uploads the photos as the offer images, each with its own signed URL', async () => {
    const { admin, provider, store } = setup();
    store.seed(ShipmentState.PENDING_SOURCING);

    const detail = await admin.createOffer(STAFF_ID, TRACKING_ID, offerDto(), [
      file({ originalname: 'front.jpg' }),
      file({ originalname: 'back.jpg' }),
    ]);

    expect(provider.uploads).toHaveLength(2);
    expect(
      provider.uploads.every((upload) =>
        upload.key.startsWith(`shipments/${TRACKING_ID}/`),
      ),
    ).toBe(true);
    expect(detail.offer?.images).toHaveLength(2);
    expect(detail.offer?.images.map((image) => image.url)).toEqual(
      provider.uploads.map((upload) => `https://signed/${upload.key}`),
    );
  });

  it('rejects a disallowed file type before touching the state machine', async () => {
    const { store, admin, provider } = setup();
    const row = store.seed(ShipmentState.PENDING_SOURCING);

    await expectInvalidFileType(
      admin.createOffer(STAFF_ID, TRACKING_ID, offerDto(), [
        file({ mimetype: 'application/pdf', buffer: PDF_BYTES }),
      ]),
    );

    expect(provider.uploads).toHaveLength(0);
    expect(row.status).toBe(ShipmentState.PENDING_SOURCING);
    expect(row.offers).toHaveLength(0);
  });

  it('rejects a photo over 10 MB', async () => {
    const { store, admin } = setup();
    store.seed(ShipmentState.PENDING_SOURCING);

    await expectFileTooLarge(
      admin.createOffer(STAFF_ID, TRACKING_ID, offerDto(), [
        file({ buffer: padded(JPEG_BYTES, 11 * 1024 * 1024) }),
      ]),
    );
  });

  it('cleans up the uploaded photo if the database write fails afterwards', async () => {
    const { store, admin, provider } = setup();
    store.seed(ShipmentState.PENDING_SOURCING);
    store.failOfferSave = true;

    await expect(
      admin.createOffer(STAFF_ID, TRACKING_ID, offerDto(), [file()]),
    ).rejects.toThrow('db exploded');

    expect(provider.uploads).toHaveLength(1);
    expect(provider.deleted).toEqual([provider.uploads[0].key]);
  });

  it('trims the supplier name, upper-cases the currency, and defaults a missing note to null', async () => {
    const { admin, store } = setup();
    store.seed(ShipmentState.PENDING_SOURCING);

    const detail = await admin.createOffer(
      STAFF_ID,
      TRACKING_ID,
      offerDto({ supplierName: '  Shenzhen Gadget Co.  ', currency: 'usd' }),
      [],
    );

    expect(detail.offer).toMatchObject({
      supplierName: 'Shenzhen Gadget Co.',
      unitPrice: { currency: 'USD' },
      note: null,
    });
  });
});

describe('confirming payment', () => {
  it('stores the full sender and recipient addresses, trimmed, alongside the route', async () => {
    const { store, admin } = setup();
    const row = store.seed(ShipmentState.PENDING_PAYMENT_CONFIRMATION);

    await admin.confirmPayment(STAFF_ID, TRACKING_ID, confirmDto());

    expect(row.sender).toMatchObject({
      name: 'Shenzhen Gadget Co.',
      city: 'Shenzhen',
      country: 'CN',
    });
    expect(row.recipient).toMatchObject({
      name: 'Maria Test',
      city: 'Paris',
      country: 'FR',
    });
  });
});

describe('posting a tracking event', () => {
  it('trims the location before recording it, with the staff member who posted it', async () => {
    const { store, admin } = setup();
    store.seed(ShipmentState.CONFIRMED);

    await admin.addEvent(STAFF_ID, TRACKING_ID, {
      status: ShipmentState.IN_TRANSIT,
      location: '  Lyon hub  ',
    } as CreateEventDto);

    expect(store.events).toEqual([
      expect.objectContaining({
        location: 'Lyon hub',
        actorType: ShipmentActorType.STAFF,
        actorId: STAFF_ID,
      }),
    ]);
  });
});

describe('uploading a file to the shipment', () => {
  it.each(ATTACHMENT_KINDS)(
    'stores a %s on the Files tab, with no linked offer',
    async (kind) => {
      const { store, admin, provider } = setup();
      const row = store.seed(ShipmentState.CONFIRMED);

      const result = await admin.uploadFile(
        TRACKING_ID,
        { kind } as UploadFileDto,
        file(),
      );

      expect(result).toMatchObject({
        kind,
        url: `https://signed/${provider.uploads[0].key}`,
      });
      expect(row.files).toEqual([
        expect.objectContaining({ kind, offerId: null }),
      ]);
    },
  );

  it('accepts a PDF — unlike a supplier-offer photo, which only allows images', async () => {
    const { admin, store } = setup();
    store.seed(ShipmentState.CONFIRMED);

    await expect(
      admin.uploadFile(
        TRACKING_ID,
        { kind: ShipmentFileKind.PROOF_OF_DELIVERY } as UploadFileDto,
        file({
          mimetype: 'application/pdf',
          originalname: 'pod.pdf',
          buffer: PDF_BYTES,
        }),
      ),
    ).resolves.toMatchObject({ mimeType: 'application/pdf' });
  });

  it('rejects an unsupported file type', async () => {
    const { admin, store } = setup();
    store.seed(ShipmentState.CONFIRMED);

    await expectInvalidFileType(
      admin.uploadFile(
        TRACKING_ID,
        { kind: ShipmentFileKind.OTHER } as UploadFileDto,
        file({ mimetype: 'video/mp4', buffer: UNKNOWN_BYTES }),
      ),
    );
  });

  it('rejects a file over 10 MB', async () => {
    const { admin, store } = setup();
    store.seed(ShipmentState.CONFIRMED);

    await expectFileTooLarge(
      admin.uploadFile(
        TRACKING_ID,
        { kind: ShipmentFileKind.OTHER } as UploadFileDto,
        file({ buffer: padded(JPEG_BYTES, 11 * 1024 * 1024) }),
      ),
    );
  });

  it('generates a storage key under the tracking id, keeping the original extension', async () => {
    const { admin, provider, store } = setup();
    store.seed(ShipmentState.CONFIRMED);

    await admin.uploadFile(
      TRACKING_ID,
      { kind: ShipmentFileKind.OTHER } as UploadFileDto,
      file({ originalname: 'manifest.pdf', mimetype: 'application/pdf' }),
    );

    expect(provider.uploads[0].key).toMatch(
      new RegExp(`^shipments/${TRACKING_ID}/\\d+-[0-9a-f-]{36}\\.pdf$`),
    );
  });

  describe('current gaps (pinned, not endorsed)', () => {
    it.each([
      ShipmentState.PENDING_SOURCING,
      ShipmentState.PENDING_CLIENT_DECISION,
      ShipmentState.DELIVERED,
      ShipmentState.CANCELLED,
    ])(
      'accepts a file from %s — uploadFile has no shipment-state check at all',
      async (status) => {
        const { store, admin } = setup();
        const row = store.seed(status);

        await admin.uploadFile(
          TRACKING_ID,
          { kind: ShipmentFileKind.OTHER } as UploadFileDto,
          file(),
        );

        expect(row.status).toBe(status); // unchanged: uploadFile never transitions
        expect(row.files).toHaveLength(1);
      },
    );
  });
});

describe('deleting a file', () => {
  it('removes a Files-tab attachment regardless of shipment status, and best-effort cleans up storage', async () => {
    const { store, admin, provider } = setup();
    const row = store.seed(ShipmentState.CONFIRMED);
    const target = store.seedFile(row.id, { kind: ShipmentFileKind.OTHER });

    await admin.deleteFile(TRACKING_ID, target.id);

    expect(row.files).toHaveLength(0);
    expect(provider.deleted).toEqual([target.storageKey]);
  });

  it('removes an offer photo while the client is still deciding', async () => {
    const { store, admin } = setup();
    const row = store.seed(ShipmentState.PENDING_CLIENT_DECISION);
    const target = store.seedFile(row.id, {
      kind: ShipmentFileKind.OFFER_PHOTO,
      offerId: 'offer-1',
    });

    await admin.deleteFile(TRACKING_ID, target.id);

    expect(row.files).toHaveLength(0);
  });

  it('refuses to remove an offer photo once the client has moved past the decision (409, 3007)', async () => {
    const { store, admin } = setup();
    const row = store.seed(ShipmentState.PENDING_PAYMENT);
    const target = store.seedFile(row.id, {
      kind: ShipmentFileKind.OFFER_PHOTO,
      offerId: 'offer-1',
    });

    await expectFileNotDeletable(admin.deleteFile(TRACKING_ID, target.id));

    expect(row.files).toHaveLength(1);
  });

  it("never removes the client's own request photos (409, 3007)", async () => {
    const { store, admin } = setup();
    const row = store.seed(ShipmentState.PENDING_SOURCING);
    const target = store.seedFile(row.id, {
      kind: ShipmentFileKind.REQUEST_PHOTO,
    });

    await expectFileNotDeletable(admin.deleteFile(TRACKING_ID, target.id));

    expect(row.files).toHaveLength(1);
  });

  it('a file id that is not attached to the shipment is a 404 (3006)', async () => {
    const { store, admin } = setup();
    store.seed(ShipmentState.CONFIRMED);

    await expectFileNotFound(admin.deleteFile(TRACKING_ID, 'nope'));
  });
});

describe('route protection', () => {
  const proto = AdminShipmentsController.prototype as unknown as Record<
    string,
    object
  >;
  const permissionOf = (method: string) =>
    Reflect.getMetadata(ACCESS_CONTROL_KEYS.PERMISSION, proto[method]) as
      string | undefined;

  it.each(['list', 'getOne', 'listEvents', 'listFiles'])(
    '%s is read-only: shipments:read:all',
    (method) => {
      expect(permissionOf(method)).toBe('shipments:read:all');
    },
  );

  it.each([
    'createOffer',
    'confirmPayment',
    'addEvent',
    'uploadFile',
    'deleteFile',
  ])('%s mutates the shipment: shipments:update:org', (method) => {
    expect(permissionOf(method)).toBe('shipments:update:org');
  });
});
