import { HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EntityTarget, QueryFailedError, Repository } from 'typeorm';
import { ACCESS_CONTROL_KEYS } from '../common/decorators/access-control.decorator';
import { CryptoService } from '../common/services/crypto.service';
import { Role } from '../access-control/entities/role.entity';
import { InternalUser } from '../internal-users/internal-user.entity';
import { InternalUsersService } from '../internal-users/internal-users.service';
import {
  InternalUserErrorCodes,
  InternalUserNotFoundException,
} from '../internal-users/exceptions';
import { Organization } from './organization.entity';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { Shipment } from '../shipments/entities/shipment.entity';
import { ApiKey } from '../public-api/entities/api-key.entity';
import { ActionSignals } from '../notifications/action-signals';
import {
  OrganizationAlreadyExistsException,
  OrganizationErrorCodes,
  OrganizationInUseException,
  OrganizationNotFoundException,
  StaffNotInOrganizationException,
} from './exceptions';

/**
 * Organizations (branches) and staff membership.
 *
 * Runs the real OrganizationsService and the real InternalUsersService
 * (setOrganization / findByOrganization) over in-memory `organization` and
 * `internal_user` tables. The organization table enforces the same UNIQUE
 * ("name") constraint as the migration, so a duplicate that slips past the
 * service fails the way Postgres would.
 *
 * Deleting counts what still points at the branch through the repository's
 * manager: its staff (the in-memory table), and shipments and API keys
 * (counts a test sets).
 */

const UNKNOWN = '00000000-0000-0000-0000-000000000000';

/** Linked shipments and API keys per organization id, which remove() counts. */
interface Linked {
  shipments: Map<string, number>;
  apiKeys: Map<string, number>;
}

/** The transaction manager remove() uses: counts what points at a branch, and deletes it. */
function fakeManager(
  organizations: Organization[],
  staff: InternalUser[],
  linked: Linked,
) {
  return {
    count: (
      target: EntityTarget<unknown>,
      { where }: { where: { organizationId: string } },
    ) => {
      if (target === InternalUser) {
        return Promise.resolve(
          staff.filter((user) => user.organizationId === where.organizationId)
            .length,
        );
      }
      expect([Shipment, ApiKey]).toContain(target);
      const counts = target === Shipment ? linked.shipments : linked.apiKeys;
      return Promise.resolve(counts.get(where.organizationId) ?? 0);
    },
    delete: (_target: unknown, id: string) => {
      const index = organizations.findIndex((org) => org.id === id);
      if (index >= 0) organizations.splice(index, 1);
      return Promise.resolve({ affected: index >= 0 ? 1 : 0 });
    },
  };
}

function setup() {
  const organizations: Organization[] = [];
  const staff: InternalUser[] = [];
  /** Shipments and API keys per organization id, for remove(). */
  const linked = {
    shipments: new Map<string, number>(),
    apiKeys: new Map<string, number>(),
  };
  /** Every ActionSignal emitted, in order. */
  const signals: Array<{ event: string; payload: unknown }> = [];
  let nextId = 1;

  const manager = fakeManager(organizations, staff, linked);

  const uniqueViolation = (name: string) =>
    new QueryFailedError(
      'INSERT/UPDATE "organization"',
      [],
      Object.assign(new Error(`duplicate key value (name)=(${name})`), {
        code: '23505',
      }),
    );

  const organizationRepository = {
    findOne: ({ where }: { where: Partial<Organization> }) =>
      Promise.resolve(
        organizations.find((row) =>
          Object.entries(where).every(
            ([key, value]) => row[key as keyof Organization] === value,
          ),
        ) ?? null,
      ),
    find: () => Promise.resolve([...organizations]),
    create: (values: Partial<Organization>) =>
      Object.assign(new Organization(), values),
    save: (org: Organization) => {
      if (organizations.some((row) => row !== org && row.name === org.name)) {
        return Promise.reject(uniqueViolation(org.name));
      }
      if (!org.id) {
        const now = new Date();
        Object.assign(org, {
          id: `org-${nextId++}`,
          isActive: org.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        });
        organizations.push(org);
      }
      return Promise.resolve(org);
    },
    update: (id: string, values: Partial<Organization>) => {
      const row = organizations.find((org) => org.id === id);
      if (row) Object.assign(row, values);
      return Promise.resolve({ affected: row ? 1 : 0 });
    },
    manager: {
      transaction: <T>(work: (transactional: typeof manager) => Promise<T>) =>
        work(manager),
    },
  };

  const internalUserRepository = {
    update: (id: string, values: Partial<InternalUser>) => {
      const row = staff.find((user) => user.id === id);
      if (row) Object.assign(row, values);
      return Promise.resolve({ affected: row ? 1 : 0 });
    },
    find: ({ where }: { where: Partial<InternalUser> }) =>
      Promise.resolve(
        staff.filter((user) => user.organizationId === where.organizationId),
      ),
    // removeStaff looks the member up first, to emit the organizationId they were removed from.
    findOne: ({ where }: { where: { id: string } }) =>
      Promise.resolve(staff.find((user) => user.id === where.id) ?? null),
  };

  const internalUsers = new InternalUsersService(
    internalUserRepository as unknown as Repository<InternalUser>,
    {} as Repository<Role>,
    {} as CryptoService,
    // Nothing listens in these tests: the notification signals it sends go nowhere.
    new EventEmitter2(),
  );
  const events = new EventEmitter2({ wildcard: true });
  events.onAny((event, payload) =>
    signals.push({ event: String(event), payload }),
  );
  const service = new OrganizationsService(
    organizationRepository as unknown as Repository<Organization>,
    internalUsers,
    events,
  );

  const addStaff = (id: string, organizationId: string | null = null) => {
    const user = Object.assign(new InternalUser(), {
      id,
      email: `${id}@example.com`,
      name: id,
      isActive: true,
      organizationId,
    });
    staff.push(user);
    return user;
  };

  return { service, organizations, staff, addStaff, linked, signals };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (reason: unknown) => reason,
  );
}

async function expectNotFound(promise: Promise<unknown>): Promise<void> {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(OrganizationNotFoundException);
  const exception = error as OrganizationNotFoundException;
  expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
  expect(exception.code).toBe(OrganizationErrorCodes.OrganizationNotFound);
}

describe('create', () => {
  it('saves an active organization and returns it with null optional fields', async () => {
    const { service } = setup();

    const org = await service.create({ name: 'Beirut' });
    const dto = await service.getById(org.id);

    expect(dto).toMatchObject({
      id: org.id,
      name: 'Beirut',
      description: null,
      contactEmail: null,
      isActive: true,
    });
  });

  it('refuses a name that is already taken (409, 4002) and saves nothing', async () => {
    const { service, organizations } = setup();
    await service.create({ name: 'Beirut' });

    const error = await rejection(service.create({ name: 'Beirut' }));

    expect(error).toBeInstanceOf(OrganizationAlreadyExistsException);
    const exception = error as OrganizationAlreadyExistsException;
    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.code).toBe(
      OrganizationErrorCodes.OrganizationAlreadyExists,
    );
    expect(organizations).toHaveLength(1);
  });

  it('a name taken by a deactivated organization is still taken', async () => {
    const { service } = setup();
    const old = await service.create({ name: 'Beirut' });
    await service.update(old.id, { isActive: false });

    await expect(service.create({ name: 'Beirut' })).rejects.toBeInstanceOf(
      OrganizationAlreadyExistsException,
    );
  });
});

describe('read', () => {
  it('lists every organization, deactivated ones included', async () => {
    const { service } = setup();
    await service.create({ name: 'Beirut' });
    const tripoli = await service.create({ name: 'Tripoli' });
    await service.update(tripoli.id, { isActive: false });

    const list = await service.findAll();

    expect(list.map((org) => [org.name, org.isActive])).toEqual([
      ['Beirut', true],
      ['Tripoli', false],
    ]);
  });

  it('an unknown id is 404 (4001)', async () => {
    const { service } = setup();

    await expectNotFound(service.getById(UNKNOWN));
  });
});

describe('update', () => {
  it('changes only the fields that were sent', async () => {
    const { service } = setup();
    const org = await service.create({
      name: 'Beirut',
      description: 'Main branch',
      contactEmail: 'beirut@example.com',
    });

    await service.update(org.id, { description: 'Head office' });

    expect(await service.getById(org.id)).toMatchObject({
      name: 'Beirut',
      description: 'Head office',
      contactEmail: 'beirut@example.com',
      isActive: true,
    });
  });

  it('deactivates and reactivates (PATCH isActive), keeping the row and its staff', async () => {
    const { service, organizations, addStaff } = setup();
    const org = await service.create({ name: 'Beirut' });
    addStaff('staff-1', org.id);

    await service.update(org.id, { isActive: false });
    expect((await service.getById(org.id)).isActive).toBe(false);
    expect(organizations).toHaveLength(1);
    expect((await service.listStaff(org.id)).map((user) => user.id)).toEqual([
      'staff-1',
    ]);

    await service.update(org.id, { isActive: true });
    expect((await service.getById(org.id)).isActive).toBe(true);
  });

  it('renaming onto a taken name is 409 (4002), like create', async () => {
    const { service } = setup();
    await service.create({ name: 'Beirut' });
    const tripoli = await service.create({ name: 'Tripoli' });

    const error = await rejection(
      service.update(tripoli.id, { name: 'Beirut' }),
    );

    expect(error).toBeInstanceOf(OrganizationAlreadyExistsException);
    expect((error as OrganizationAlreadyExistsException).getStatus()).toBe(
      HttpStatus.CONFLICT,
    );
    expect((await service.getById(tripoli.id)).name).toBe('Tripoli');
  });

  it('keeping its own name is not a conflict', async () => {
    const { service } = setup();
    const org = await service.create({ name: 'Beirut' });

    await expect(
      service.update(org.id, { name: 'Beirut', description: 'x' }),
    ).resolves.toMatchObject({ name: 'Beirut', description: 'x' });
  });

  it('an unknown id is 404 (4001)', async () => {
    const { service } = setup();

    await expectNotFound(service.update(UNKNOWN, { name: 'Beirut' }));
  });
});

describe('remove', () => {
  it('deletes a branch nothing points at, and signals it with its name', async () => {
    const { service, organizations, signals } = setup();
    const org = await service.create({ name: 'Beirut' });

    await service.remove(org.id);

    expect(organizations).toEqual([]);
    expect(signals).toContainEqual({
      event: ActionSignals.ORGANIZATION_DELETED,
      payload: { organizationId: org.id, name: 'Beirut' },
    });
  });

  it.each(['staff', 'shipments', 'apiKeys'] as const)(
    'refuses a branch that still has %s: 409 (4003), and keeps it',
    async (what) => {
      const { service, organizations, addStaff, linked } = setup();
      const org = await service.create({ name: 'Beirut' });
      if (what === 'staff') addStaff('staff-1', org.id);
      else linked[what].set(org.id, 2);

      const error = await rejection(service.remove(org.id));

      expect(error).toBeInstanceOf(OrganizationInUseException);
      expect((error as OrganizationInUseException).code).toBe(
        OrganizationErrorCodes.OrganizationInUse,
      );
      expect(organizations).toHaveLength(1);
    },
  );

  it('an unknown id is 404 (4001)', async () => {
    const { service } = setup();

    await expectNotFound(service.remove(UNKNOWN));
  });
});

describe('staff membership', () => {
  it('assigning puts the staff member in the organization', async () => {
    const { service, addStaff } = setup();
    const org = await service.create({ name: 'Beirut' });
    addStaff('staff-1');

    await service.assignStaff(org.id, 'staff-1');

    expect(
      (await service.listStaff(org.id)).map((user) => user.organizationId),
    ).toEqual([org.id]);
  });

  it('assigning to another organization moves them, a member belongs to one at a time', async () => {
    const { service, addStaff } = setup();
    const beirut = await service.create({ name: 'Beirut' });
    const tripoli = await service.create({ name: 'Tripoli' });
    addStaff('staff-1', beirut.id);

    await service.assignStaff(tripoli.id, 'staff-1');

    expect(await service.listStaff(beirut.id)).toEqual([]);
    expect(
      (await service.listStaff(tripoli.id)).map((user) => user.id),
    ).toEqual(['staff-1']);
  });

  it('assigning to an unknown organization is 404 (4001) and leaves the member where they were', async () => {
    const { service, staff, addStaff } = setup();
    const beirut = await service.create({ name: 'Beirut' });
    addStaff('staff-1', beirut.id);

    await expectNotFound(service.assignStaff(UNKNOWN, 'staff-1'));
    expect(staff[0].organizationId).toBe(beirut.id);
  });

  it('assigning an unknown staff member is 404 from internal-users', async () => {
    const { service } = setup();
    const org = await service.create({ name: 'Beirut' });

    const error = await rejection(service.assignStaff(org.id, 'ghost'));

    expect(error).toBeInstanceOf(InternalUserNotFoundException);
    expect((error as InternalUserNotFoundException).code).toBe(
      InternalUserErrorCodes.InternalUserNotFound,
    );
  });

  it('removing clears the organization', async () => {
    const { service, staff, addStaff } = setup();
    const org = await service.create({ name: 'Beirut' });
    addStaff('staff-1', org.id);

    await service.removeStaff(org.id, 'staff-1');

    expect(staff[0].organizationId).toBeNull();
    expect(await service.listStaff(org.id)).toEqual([]);
  });

  it('removing someone from a branch they aren’t in is 404 (4004), and they stay where they are', async () => {
    const { service, staff, addStaff } = setup();
    const beirut = await service.create({ name: 'Beirut' });
    const tripoli = await service.create({ name: 'Tripoli' });
    addStaff('staff-1', tripoli.id);

    const error = await rejection(service.removeStaff(beirut.id, 'staff-1'));

    expect(error).toBeInstanceOf(StaffNotInOrganizationException);
    expect((error as StaffNotInOrganizationException).code).toBe(
      OrganizationErrorCodes.StaffNotInOrganization,
    );
    expect(staff[0].organizationId).toBe(tripoli.id);
  });

  it('assigning someone where they already are changes nothing and signals nothing', async () => {
    const { service, addStaff, signals } = setup();
    const org = await service.create({ name: 'Beirut' });
    addStaff('staff-1', org.id);
    signals.length = 0;

    await service.assignStaff(org.id, 'staff-1');

    expect(signals).toEqual([]);
  });

  it('moving someone signals both: removed from the old branch, added to the new one', async () => {
    const { service, addStaff, signals } = setup();
    const beirut = await service.create({ name: 'Beirut' });
    const tripoli = await service.create({ name: 'Tripoli' });
    addStaff('staff-1', beirut.id);
    signals.length = 0;

    await service.assignStaff(tripoli.id, 'staff-1');

    expect(signals).toEqual([
      {
        event: ActionSignals.ORGANIZATION_STAFF_REMOVED,
        payload: { organizationId: beirut.id, internalUserId: 'staff-1' },
      },
      {
        event: ActionSignals.ORGANIZATION_STAFF_ADDED,
        payload: { organizationId: tripoli.id, internalUserId: 'staff-1' },
      },
    ]);
  });

  it('listing only returns that organization’s staff', async () => {
    const { service, addStaff } = setup();
    const beirut = await service.create({ name: 'Beirut' });
    const tripoli = await service.create({ name: 'Tripoli' });
    addStaff('staff-1', beirut.id);
    addStaff('staff-2', tripoli.id);
    addStaff('staff-3');

    expect((await service.listStaff(beirut.id)).map((user) => user.id)).toEqual(
      ['staff-1'],
    );
  });

  it('listing an unknown organization is 404 (4001)', async () => {
    const { service } = setup();

    await expectNotFound(service.listStaff(UNKNOWN));
  });
});

describe('route protection', () => {
  const proto = OrganizationsController.prototype as unknown as Record<
    string,
    object
  >;
  const permissionOf = (method: string) =>
    Reflect.getMetadata(ACCESS_CONTROL_KEYS.PERMISSION, proto[method]) as
      string | undefined;
  const staffOnly = (method: string) =>
    Reflect.getMetadata(ACCESS_CONTROL_KEYS.STAFF, proto[method]) === true;

  it.each(['create', 'update', 'remove', 'assignStaff', 'removeStaff'])(
    '%s needs organizations:manage',
    (method) => {
      expect(permissionOf(method)).toBe('organizations:manage');
    },
  );

  it.each(['findAll', 'findOne', 'listStaff'])(
    '%s is staff-only (customer tokens are refused)',
    (method) => {
      expect(staffOnly(method)).toBe(true);
    },
  );
});
