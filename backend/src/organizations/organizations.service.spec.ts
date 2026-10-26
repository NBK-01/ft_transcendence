import { HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryFailedError, Repository } from 'typeorm';
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
import {
  OrganizationAlreadyExistsException,
  OrganizationErrorCodes,
  OrganizationNotFoundException,
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
 * The "current gaps" block pins behaviour that looks wrong but is what the
 * code does today, so a fix shows up as a deliberate test change.
 */

const UNKNOWN = '00000000-0000-0000-0000-000000000000';

function setup() {
  const organizations: Organization[] = [];
  const staff: InternalUser[] = [];
  let nextId = 1;

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
  const service = new OrganizationsService(
    organizationRepository as unknown as Repository<Organization>,
    internalUsers,
    new EventEmitter2(),
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

  return { service, organizations, staff, addStaff };
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
    await service.deactivate(old.id);

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
    await service.deactivate(tripoli.id);

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

  it('can reactivate a deactivated organization', async () => {
    const { service } = setup();
    const org = await service.create({ name: 'Beirut' });
    await service.deactivate(org.id);

    await service.update(org.id, { isActive: true });

    expect((await service.getById(org.id)).isActive).toBe(true);
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

describe('deactivate', () => {
  it('is a soft toggle: the row stays and its staff stay assigned', async () => {
    const { service, organizations, addStaff } = setup();
    const org = await service.create({ name: 'Beirut' });
    addStaff('staff-1', org.id);

    await service.deactivate(org.id);

    expect(organizations).toHaveLength(1);
    expect((await service.getById(org.id)).isActive).toBe(false);
    expect((await service.listStaff(org.id)).map((user) => user.id)).toEqual([
      'staff-1',
    ]);
  });

  it('an unknown id is 404 (4001)', async () => {
    const { service } = setup();

    await expectNotFound(service.deactivate(UNKNOWN));
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

    await service.removeStaff('staff-1');

    expect(staff[0].organizationId).toBeNull();
    expect(await service.listStaff(org.id)).toEqual([]);
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

describe('current gaps (pinned, not endorsed)', () => {
  it('DELETE /organizations/:id/staff/:userId ignores :id, so it unassigns a member of a DIFFERENT organization', async () => {
    const { service, staff, addStaff } = setup();
    const beirut = await service.create({ name: 'Beirut' });
    const tripoli = await service.create({ name: 'Tripoli' });
    addStaff('staff-1', tripoli.id);

    // The controller drops :id and calls removeStaff(userId) only, so
    // "remove staff-1 from Beirut" silently takes them out of Tripoli.
    await new OrganizationsController(service).removeStaff('staff-1');

    expect(beirut.id).not.toBe(tripoli.id);
    expect(staff[0].organizationId).toBeNull();
  });

  it('renaming onto a taken name is not caught by the service: it fails as a raw DB error (500), not 409', async () => {
    const { service } = setup();
    await service.create({ name: 'Beirut' });
    const tripoli = await service.create({ name: 'Tripoli' });

    const error = await rejection(
      service.update(tripoli.id, { name: 'Beirut' }),
    );

    expect(error).toBeInstanceOf(QueryFailedError);
    expect(error).not.toBeInstanceOf(OrganizationAlreadyExistsException);
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

  it.each(['create', 'update', 'deactivate', 'assignStaff', 'removeStaff'])(
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
