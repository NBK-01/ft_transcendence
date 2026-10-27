import { randomBytes, randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActionSignals } from '../notifications/action-signals';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Organization } from '../organizations/organization.entity';
import { OrganizationNotFoundException } from '../organizations/exceptions';
import { InternalUser } from '../internal-users/internal-user.entity';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeysService } from './api-keys.service';
import {
  ApiKeyBranchInactiveException,
  ApiKeyNotFoundException,
} from './exceptions';
import {
  API_KEY_VISIBLE_PREFIX_LENGTH,
  ApiKeyRejection,
} from './constants/api-key.constants';

type Where = Record<string, unknown>;
type Order = Record<string, 'ASC' | 'DESC'>;
type Relations = { organization?: boolean; createdBy?: boolean };

function field(row: ApiKey, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

/** TypeORM's where semantics for what the service uses: equality, IsNull, LessThanOrEqual and Or. */
function satisfies(value: unknown, condition: unknown): boolean {
  if (!(condition instanceof FindOperator)) {
    return value === condition;
  }
  switch (condition.type) {
    case 'isNull':
      return value === null || value === undefined;
    case 'lessThanOrEqual':
      return (
        value instanceof Date &&
        value.getTime() <= (condition.value as Date).getTime()
      );
    case 'or':
      return (condition.value as unknown[]).some((operator) =>
        satisfies(value, operator),
      );
    default:
      throw new Error(
        `Fake repository: unsupported operator ${condition.type}`,
      );
  }
}

function sortValue(row: ApiKey, key: string): number | string {
  const value = field(row, key);
  return value instanceof Date ? value.getTime() : String(value);
}

let clock = 0;

/** A minute after the previous one, so "newest first" is well defined. */
function nextCreatedAt(): Date {
  clock += 1;
  return new Date(Date.UTC(2026, 9, 25, 9, clock));
}

/**
 * In-memory stand-in for Repository<ApiKey>, just big enough for the
 * service's queries. Reads return copies with the requested relations
 * joined from the branches and staff the test set up, like a real query.
 */
class FakeApiKeyRepository {
  rows: ApiKey[] = [];

  constructor(
    private readonly branches: Map<string, Organization>,
    private readonly staff: Map<string, InternalUser>,
  ) {}

  create(values: Partial<ApiKey>): ApiKey {
    return { ...values } as ApiKey;
  }

  async save(entity: ApiKey): Promise<ApiKey> {
    const createdAt = nextCreatedAt();
    // Nullable columns the insert leaves out are NULL, as in the database.
    const row: ApiKey = {
      ...entity,
      lastUsedAt: entity.lastUsedAt ?? null,
      revokedAt: entity.revokedAt ?? null,
      id: randomUUID(),
      createdAt,
      updatedAt: createdAt,
    };
    this.rows.push(row);
    return { ...row };
  }

  async findOne(options: {
    where: Where;
    relations?: Relations;
  }): Promise<ApiKey | null> {
    const [row] = this.filter(options.where);
    return row ? this.load(row, options.relations) : null;
  }

  async find(options: {
    where: Where;
    relations?: Relations;
    order: Order;
  }): Promise<ApiKey[]> {
    return this.sorted(this.filter(options.where), options.order).map((row) =>
      this.load(row, options.relations),
    );
  }

  async update(
    where: Where,
    changes: Partial<ApiKey>,
  ): Promise<{ affected: number }> {
    const found = this.filter(where);
    found.forEach((row) => Object.assign(row, changes));
    return { affected: found.length };
  }

  private filter(where: Where): ApiKey[] {
    return this.rows.filter((row) =>
      Object.entries(where).every(([key, condition]) =>
        satisfies(field(row, key), condition),
      ),
    );
  }

  private sorted(rows: ApiKey[], order: Order): ApiKey[] {
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

  private load(row: ApiKey, relations: Relations = {}): ApiKey {
    const loaded = { ...row };
    if (relations.organization) {
      loaded.organization = this.branches.get(row.organizationId);
    }
    if (relations.createdBy) {
      loaded.createdBy =
        (row.createdById && this.staff.get(row.createdById)) || null;
    }
    return loaded;
  }
}

function makeBranch(name: string, isActive = true): Organization {
  const createdAt = new Date(Date.UTC(2026, 0, 1));
  return {
    id: randomUUID(),
    name,
    description: null,
    contactEmail: null,
    isActive,
    createdAt,
    updatedAt: createdAt,
  };
}

const HMAC_SECRET = randomBytes(32).toString('hex');

function configWith(secret: string | undefined): ConfigService {
  return {
    get: (name: string) =>
      name === 'API_KEY_HMAC_SECRET' ? secret : undefined,
  } as unknown as ConfigService;
}

/** A key in the right format that nobody created. */
function randomKey(): string {
  return `stk_${randomBytes(32).toString('hex')}`;
}

let lyon: Organization;
let marseille: Organization;
/** Deactivated. */
let paris: Organization;
let admin: InternalUser;
let branches: Map<string, Organization>;
let apiKeys: FakeApiKeyRepository;
let service: ApiKeysService;
let events: { emit: jest.Mock };

/** A stored key without a real hash: for the tests that never check one (no bcrypt cost). */
function seedKey(overrides: Partial<ApiKey> = {}): ApiKey {
  const createdAt = nextCreatedAt();
  const row: ApiKey = {
    id: randomUUID(),
    createdAt,
    updatedAt: createdAt,
    name: 'Carrier tracking sync',
    organizationId: lyon.id,
    prefix: `stk_${randomBytes(2).toString('hex')}`,
    last4: randomBytes(2).toString('hex'),
    keyHash: `$2b$10$${'x'.repeat(53)}`,
    keyHmac: randomBytes(32).toString('hex'),
    createdById: admin.id,
    lastUsedAt: null,
    revokedAt: null,
    ...overrides,
  };
  apiKeys.rows.push(row);
  return row;
}

function storedRow(id: string): ApiKey {
  const row = apiKeys.rows.find((candidate) => candidate.id === id);
  if (!row) {
    throw new Error(`No stored row ${id}`);
  }
  return row;
}

function createKey(name = 'Carrier tracking sync', organizationId = lyon.id) {
  return service.create({ name, organizationId }, admin.id);
}

/** Both of the guard's checks, in its order (it rate-limits in between). */
async function verify(key: string) {
  const found = await service.identify(key);
  return found.valid ? service.confirm(key, found.record) : found;
}

// Top level, so it runs before every test in the file: each starts with empty tables.
beforeEach(async () => {
  lyon = makeBranch('Lyon');
  marseille = makeBranch('Marseille');
  admin = { id: randomUUID(), name: 'Jane Admin' } as InternalUser;
  paris = makeBranch('Paris', false);
  branches = new Map([lyon, marseille, paris].map((b) => [b.id, b]));
  apiKeys = new FakeApiKeyRepository(branches, new Map([[admin.id, admin]]));
  events = { emit: jest.fn() };

  const moduleRef = await Test.createTestingModule({
    providers: [
      ApiKeysService,
      { provide: getRepositoryToken(ApiKey), useValue: apiKeys },
      {
        provide: getRepositoryToken(Organization),
        useValue: {
          findOne: async ({ where }: { where: { id: string } }) =>
            branches.get(where.id) ?? null,
        },
      },
      { provide: ConfigService, useValue: configWith(HMAC_SECRET) },
      { provide: EventEmitter2, useValue: events },
    ],
  }).compile();
  service = moduleRef.get(ApiKeysService);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ApiKeysService setup', () => {
  it.each([undefined, '', 'too-short'])(
    'refuses to start when API_KEY_HMAC_SECRET is %p',
    (secret) => {
      const repository = {} as Repository<ApiKey>;
      expect(
        () =>
          new ApiKeysService(
            repository,
            {} as Repository<Organization>,
            configWith(secret),
            {} as EventEmitter2,
          ),
      ).toThrow(/API_KEY_HMAC_SECRET/);
    },
  );
});

describe('ApiKeysService.create', () => {
  it('returns a stk_ key of 64 hex characters, with the record', async () => {
    const created = await createKey();

    expect(created.key).toMatch(/^stk_[0-9a-f]{64}$/);
    expect(created).toMatchObject({
      name: 'Carrier tracking sync',
      maskedKey: `${created.key.slice(0, 8)}…${created.key.slice(-4)}`,
      organization: { id: lyon.id, name: 'Lyon' },
      createdBy: { id: admin.id, name: 'Jane Admin' },
      lastUsedAt: null,
      revokedAt: null,
    });
  });

  it('gives every key its own random part', async () => {
    const created = await Promise.all(
      Array.from({ length: 8 }, () => createKey()),
    );

    expect(new Set(created.map(({ key }) => key)).size).toBe(8);
    expect(new Set(apiKeys.rows.map((row) => row.keyHmac)).size).toBe(8);
  });

  it('never stores the key: only its bcrypt hash, its HMAC and its two ends', async () => {
    const { id, key } = await createKey();
    const row = storedRow(id);

    // The 56 characters between the visible ends appear nowhere in the row.
    const hidden = key.slice(API_KEY_VISIBLE_PREFIX_LENGTH, -4);
    expect(JSON.stringify(row)).not.toContain(hidden);
    expect(row.prefix).toBe(key.slice(0, 8));
    expect(row.last4).toBe(key.slice(-4));
    expect(row.keyHmac).toMatch(/^[0-9a-f]{64}$/);
    expect(row.keyHash).toMatch(/^\$2b\$10\$/);
    await expect(bcrypt.compare(key, row.keyHash)).resolves.toBe(true);
  });

  it('is a 404 for an unknown branch and a 400 for an inactive one, and stores nothing', async () => {
    await expect(createKey('x', randomUUID())).rejects.toBeInstanceOf(
      OrganizationNotFoundException,
    );
    await expect(createKey('x', paris.id)).rejects.toBeInstanceOf(
      ApiKeyBranchInactiveException,
    );
    expect(apiKeys.rows).toEqual([]);
  });
});

describe('ApiKeysService.list', () => {
  it('shows every key masked, newest first, revoked ones included', async () => {
    const older = seedKey({ revokedAt: new Date() });
    const newer = seedKey({ organizationId: marseille.id });

    const list = await service.list({});

    expect(list.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(list[1].revokedAt).toBeInstanceOf(Date);
    expect(list[0]).toEqual({
      id: newer.id,
      name: newer.name,
      maskedKey: `${newer.prefix}…${newer.last4}`,
      organization: { id: marseille.id, name: 'Marseille' },
      createdBy: { id: admin.id, name: 'Jane Admin' },
      createdAt: newer.createdAt,
      lastUsedAt: null,
      revokedAt: null,
    });
  });

  it('never shows the key, its hash or its HMAC', async () => {
    const { key } = await createKey();
    const [row] = apiKeys.rows;

    const json = JSON.stringify(await service.list({}));

    expect(json).not.toContain(key.slice(API_KEY_VISIBLE_PREFIX_LENGTH, -4));
    expect(json).not.toContain(row.keyHash);
    expect(json).not.toContain(row.keyHmac);
  });

  it('filters by branch', async () => {
    const lyonKey = seedKey();
    seedKey({ organizationId: marseille.id });

    const list = await service.list({ organizationId: lyon.id });

    expect(list.map((item) => item.id)).toEqual([lyonKey.id]);
  });

  it('shows no creator when that staff account is gone', async () => {
    seedKey({ createdById: null });

    const [item] = await service.list({});

    expect(item.createdBy).toBeNull();
  });
});

describe('ApiKeysService.revoke', () => {
  it('sets revokedAt, and the key stops working', async () => {
    const { id, key } = await createKey();

    const revoked = await service.revoke(id);

    expect(revoked.revokedAt).toBeInstanceOf(Date);
    await expect(verify(key)).resolves.toEqual({
      valid: false,
      reason: ApiKeyRejection.REVOKED,
    });
  });

  it('is idempotent: revoking again keeps the first date', async () => {
    const firstRevokedAt = new Date(Date.UTC(2026, 9, 1));
    const row = seedKey({ revokedAt: firstRevokedAt });

    const again = await service.revoke(row.id);

    expect(again.revokedAt).toEqual(firstRevokedAt);
    expect(storedRow(row.id).revokedAt).toEqual(firstRevokedAt);
  });

  it('is a 404 for an unknown id', async () => {
    await expect(service.revoke(randomUUID())).rejects.toBeInstanceOf(
      ApiKeyNotFoundException,
    );
  });
});

describe('ApiKeysService.identify, then confirm', () => {
  it('accepts a valid key and says which branch it acts for', async () => {
    const { id, key } = await createKey('Partner sync');

    await expect(verify(key)).resolves.toEqual({
      valid: true,
      apiKey: {
        id,
        name: 'Partner sync',
        organizationId: lyon.id,
        organizationName: 'Lyon',
      },
    });
  });

  it('refuses a wrong key with the same visible start and end', async () => {
    const { key } = await createKey();
    const middle = randomBytes(28).toString('hex');
    const lookalike = `${key.slice(0, 8)}${middle}${key.slice(-4)}`;

    await expect(verify(lookalike)).resolves.toEqual({
      valid: false,
      reason: ApiKeyRejection.INVALID,
    });
  });

  it('refuses an unknown key', async () => {
    await createKey();

    await expect(verify(randomKey())).resolves.toEqual({
      valid: false,
      reason: ApiKeyRejection.INVALID,
    });
  });

  it('refuses anything not shaped like a key without asking the database', async () => {
    const findOne = jest.spyOn(apiKeys, 'findOne');
    const key = randomKey();

    for (const candidate of [
      '',
      'stk_',
      `sk_${key.slice(4)}`,
      key.toUpperCase(),
      `${key}0`,
      ` ${key}`,
    ]) {
      await expect(verify(candidate)).resolves.toEqual({
        valid: false,
        reason: ApiKeyRejection.INVALID,
      });
    }
    expect(findOne).not.toHaveBeenCalled();
  });

  it('refuses a row whose bcrypt hash does not match, even though the HMAC found it', async () => {
    const { id, key } = await createKey();
    storedRow(id).keyHash = await bcrypt.hash(randomKey(), 4);

    await expect(verify(key)).resolves.toEqual({
      valid: false,
      reason: ApiKeyRejection.INVALID,
    });
  });

  it('refuses a key whose branch was deactivated, or whose branch is gone', async () => {
    const { key } = await createKey();

    lyon.isActive = false;
    await expect(verify(key)).resolves.toEqual({
      valid: false,
      reason: ApiKeyRejection.BRANCH_INACTIVE,
    });

    branches.delete(lyon.id);
    await expect(verify(key)).resolves.toEqual({
      valid: false,
      reason: ApiKeyRejection.BRANCH_INACTIVE,
    });
  });

  it('finds a key, revoked or not, without the bcrypt check: only confirm runs it', async () => {
    const { id, key } = await createKey();
    const compare = jest.spyOn(bcrypt, 'compare');

    await expect(service.identify(key)).resolves.toMatchObject({
      valid: true,
      record: { id },
    });
    await service.revoke(id);
    await expect(service.identify(key)).resolves.toEqual({
      valid: false,
      reason: ApiKeyRejection.REVOKED,
    });
    expect(compare).not.toHaveBeenCalled();
  });

  it('only says REVOKED to someone holding the real key', async () => {
    const { id, key } = await createKey();
    await service.revoke(id);
    const lookalike = `${key.slice(0, -1)}${key.endsWith('0') ? '1' : '0'}`;

    await expect(verify(lookalike)).resolves.toEqual({
      valid: false,
      reason: ApiKeyRejection.INVALID,
    });
  });
});

describe('ApiKeysService.touchLastUsed', () => {
  const start = new Date(Date.UTC(2026, 9, 25, 12, 0, 0));

  beforeEach(() => {
    jest.useFakeTimers({ now: start });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('writes lastUsedAt the first time', async () => {
    const row = seedKey();

    await expect(service.touchLastUsed(row.id)).resolves.toBe(true);

    expect(storedRow(row.id).lastUsedAt).toEqual(start);
  });

  it('writes at most once a minute per key, without even a query in between', async () => {
    const row = seedKey();
    const update = jest.spyOn(apiKeys, 'update');

    await service.touchLastUsed(row.id);
    jest.setSystemTime(start.getTime() + 59_000);
    await expect(service.touchLastUsed(row.id)).resolves.toBe(false);
    expect(update).toHaveBeenCalledTimes(1);
    expect(storedRow(row.id).lastUsedAt).toEqual(start);

    jest.setSystemTime(start.getTime() + 60_000);
    await expect(service.touchLastUsed(row.id)).resolves.toBe(true);
    expect(update).toHaveBeenCalledTimes(2);
    expect(storedRow(row.id).lastUsedAt).toEqual(
      new Date(start.getTime() + 60_000),
    );
  });

  it('writes once for requests that arrive together', async () => {
    const row = seedKey();
    const update = jest.spyOn(apiKeys, 'update');

    const results = await Promise.all([
      service.touchLastUsed(row.id),
      service.touchLastUsed(row.id),
      service.touchLastUsed(row.id),
    ]);

    expect(results).toEqual([true, false, false]);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('keeps each key separate', async () => {
    const [first, second] = [seedKey(), seedKey()];

    await expect(service.touchLastUsed(first.id)).resolves.toBe(true);
    await expect(service.touchLastUsed(second.id)).resolves.toBe(true);
  });

  it('leaves a value another app instance wrote less than a minute ago', async () => {
    const recently = new Date(start.getTime() - 10_000);
    const row = seedKey({ lastUsedAt: recently });

    await expect(service.touchLastUsed(row.id)).resolves.toBe(false);

    expect(storedRow(row.id).lastUsedAt).toEqual(recently);
  });

  it('never throws: a failed write is logged and reported as not written', async () => {
    const row = seedKey();
    jest.spyOn(apiKeys, 'update').mockRejectedValueOnce(new Error('db down'));
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await expect(service.touchLastUsed(row.id)).resolves.toBe(false);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).not.toContain('stk_');
  });
});

describe('ApiKeysService: telling the other admins', () => {
  it('signals a new key once, masked: never the key itself', async () => {
    const created = await createKey('Carrier sync');

    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith(ActionSignals.API_KEY_CREATED, {
      apiKeyId: created.id,
      name: 'Carrier sync',
      organizationId: lyon.id,
      branchName: 'Lyon',
      maskedKey: created.maskedKey,
    });
    expect(JSON.stringify(events.emit.mock.calls)).not.toContain(created.key);
  });

  it('signals a revoke once: revoking again tells no one', async () => {
    const row = seedKey();

    await service.revoke(row.id);
    await service.revoke(row.id);

    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith(
      ActionSignals.API_KEY_REVOKED,
      expect.objectContaining({ apiKeyId: row.id, branchName: 'Lyon' }),
    );
  });

  it('signals nothing when the create or revoke fails', async () => {
    await expect(createKey('X', paris.id)).rejects.toThrow();
    await expect(service.revoke(randomUUID())).rejects.toThrow();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
