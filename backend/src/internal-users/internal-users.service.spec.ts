import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryFailedError, Repository } from 'typeorm';
import { AccessControlService } from '../access-control/access-control.service';
import { Permission } from '../access-control/entities/permission.entity';
import { RolePermission } from '../access-control/entities/role-permission.entity';
import { Role } from '../access-control/entities/role.entity';
import {
  AccessControlErrorCodes,
  InsufficientPermissionsException,
  InternalUserInactiveException,
  RoleNotFoundException,
} from '../access-control/exceptions';
import { AccessControlGuard } from '../access-control/guards/access-control.guard';
import { AuthContextService } from '../common/context';
import { AccountType, RequestUser } from '../common/context/auth-context.types';
import { DomainException } from '../common/exceptions/base/error-types';
import { CryptoService } from '../common/services/crypto.service';
import { InternalUser } from './internal-user.entity';
import { InternalUsersController } from './internal-users.controller';
import { InternalUsersService } from './internal-users.service';
import {
  InternalUserAlreadyExistsException,
  InternalUserErrorCodes,
  InternalUserNotFoundException,
} from './exceptions';

/**
 * Staff accounts: create, read, update (role, org, name, active status).
 *
 * Runs the real InternalUsersService with the real argon2 CryptoService over
 * in-memory `internal_user` / `role` tables. The same tables back the real
 * AccessControlService + AccessControlGuard, so "deactivated" and "role
 * changed" are checked the way a request would actually hit them.
 *
 * There is no bulk activate/deactivate endpoint today; switching an account
 * on or off is PATCH /internal-users/:id { isActive } one account at a time.
 *
 * The "current gaps" block pins behaviour that looks wrong but is what the
 * code does today, so a fix shows up as a deliberate test change.
 */

const ORG = '11111111-1111-1111-1111-111111111111';
const UNKNOWN = '00000000-0000-0000-0000-000000000000';
const ROLE_NAMES = ['admin', 'dispatcher', 'driver', 'support'];

const matches = <T extends object>(row: T, where: Partial<T>): boolean =>
  Object.entries(where).every(([key, value]) => row[key as keyof T] === value);

// Only what the guard asks for: dispatchers can read organizations.
const rolePermissionRepository = {
  find: ({ where }: { where: { roleId: string } }) =>
    Promise.resolve(
      where.roleId === 'role-dispatcher'
        ? [
            Object.assign(new RolePermission(), {
              permission: Object.assign(new Permission(), {
                name: 'organizations:read',
              }),
            }),
          ]
        : [],
    ),
};

function setup() {
  const roles = ROLE_NAMES.map((name) =>
    Object.assign(new Role(), { id: `role-${name}`, name }),
  );
  const organizationIds = new Set([ORG]);
  const users: InternalUser[] = [];
  let nextId = 1;

  const withRole = (user: InternalUser) => {
    user.role = roles.find((role) => role.id === user.roleId);
    return user;
  };
  const dbError = (code: string, message: string) =>
    new QueryFailedError(
      'INSERT/UPDATE "internal_user"',
      [],
      Object.assign(new Error(message), { code }),
    );

  const userRepository = {
    findOne: ({ where }: { where: Partial<InternalUser> }) => {
      const row = users.find((user) => matches(user, where));
      return Promise.resolve(row ? withRole(row) : null);
    },
    find: ({ where }: { where?: Partial<InternalUser> } = {}) =>
      Promise.resolve(
        users.filter((user) => !where || matches(user, where)).map(withRole),
      ),
    create: (values: Partial<InternalUser>) =>
      Object.assign(new InternalUser(), values),
    save: (user: InternalUser) => {
      // The two constraints Postgres would enforce on this table.
      if (users.some((row) => row !== user && row.email === user.email)) {
        return Promise.reject(dbError('23505', 'duplicate key (email)'));
      }
      if (user.organizationId && !organizationIds.has(user.organizationId)) {
        return Promise.reject(
          dbError('23503', 'violates foreign key (organization_id)'),
        );
      }
      if (!user.id) {
        const now = new Date();
        Object.assign(user, {
          id: `staff-${nextId++}`,
          isActive: user.isActive ?? true,
          forceLogoutAfter: null,
          createdAt: now,
          updatedAt: now,
        });
        users.push(user);
      }
      return Promise.resolve(user);
    },
    update: (id: string, values: Partial<InternalUser>) => {
      const row = users.find((user) => user.id === id);
      if (row) Object.assign(row, values);
      return Promise.resolve({ affected: row ? 1 : 0 });
    },
  };
  const roleRepository = {
    findOne: ({ where }: { where: Partial<Role> }) =>
      Promise.resolve(roles.find((role) => matches(role, where)) ?? null),
  };

  const crypto = new CryptoService();
  const service = new InternalUsersService(
    userRepository as unknown as Repository<InternalUser>,
    roleRepository as unknown as Repository<Role>,
    crypto,
    new EventEmitter2(),
  );
  const accessControl = new AccessControlService(
    userRepository as unknown as Repository<InternalUser>,
    roleRepository as unknown as Repository<Role>,
    rolePermissionRepository as unknown as Repository<RolePermission>,
  );

  /** Runs one request as `caller` through the real guard against a controller method. */
  const callAs = (
    caller: RequestUser,
    method: keyof InternalUsersController,
  ) => {
    const guard = new AccessControlGuard(new Reflector(), accessControl, {
      requireUser: () => caller,
    } as unknown as AuthContextService);
    const context = {
      getHandler: () => InternalUsersController.prototype[method],
      getClass: () => InternalUsersController,
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  };

  const create = (
    overrides: Partial<{
      email: string;
      roleName: string;
      organizationId: string;
    }> = {},
  ) =>
    service.create({
      email: `user${nextId}@example.com`,
      password: 'SecurePass123',
      name: 'Jane',
      roleName: 'dispatcher',
      ...overrides,
    });

  return { service, users, crypto, create, callAs };
}

const staffToken = (id: string): RequestUser => ({
  id,
  email: `${id}@example.com`,
  accountType: AccountType.STAFF,
});

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (reason: unknown) => reason,
  );
}

async function expectDomainError(
  promise: Promise<unknown>,
  type: abstract new (...args: never[]) => DomainException,
  status: HttpStatus,
  code: number,
): Promise<void> {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(type);
  expect((error as DomainException).getStatus()).toBe(status);
  expect((error as DomainException).code).toBe(code);
}

const expectUserNotFound = (promise: Promise<unknown>) =>
  expectDomainError(
    promise,
    InternalUserNotFoundException,
    HttpStatus.NOT_FOUND,
    InternalUserErrorCodes.InternalUserNotFound,
  );
const expectRoleNotFound = (promise: Promise<unknown>) =>
  expectDomainError(
    promise,
    RoleNotFoundException,
    HttpStatus.NOT_FOUND,
    AccessControlErrorCodes.RoleNotFound,
  );

describe('create', () => {
  it('saves an active account with its role and org, and hashes the password', async () => {
    const { create, crypto } = setup();

    const user = await create({ roleName: 'driver', organizationId: ORG });

    expect(user).toMatchObject({
      isActive: true,
      roleId: 'role-driver',
      organizationId: ORG,
    });
    expect(user.role?.name).toBe('driver');
    expect(user.password).not.toBe('SecurePass123');
    await expect(
      crypto.comparePassword('SecurePass123', user.password),
    ).resolves.toBe(true);
  });

  it('refuses an email already in use, whatever its case (409, 8002)', async () => {
    const { create, users } = setup();
    await create({ email: 'jane@example.com' });

    await expectDomainError(
      create({ email: 'JANE@example.com' }),
      InternalUserAlreadyExistsException,
      HttpStatus.CONFLICT,
      InternalUserErrorCodes.InternalUserAlreadyExists,
    );
    expect(users).toHaveLength(1);
  });

  it('refuses an unknown role (404, 7004) and saves nothing', async () => {
    const { create, users } = setup();

    await expectRoleNotFound(create({ roleName: 'superuser' }));
    expect(users).toHaveLength(0);
  });
});

describe('read', () => {
  it('lists every account, deactivated ones included, with role names', async () => {
    const { create, service } = setup();
    await create({ roleName: 'admin' });
    const driver = await create({ roleName: 'driver' });
    await service.update(driver.id, { isActive: false });

    const list = await service.findAll();

    expect(list.map((user) => [user.roleName, user.isActive])).toEqual([
      ['admin', true],
      ['driver', false],
    ]);
  });

  it('never exposes the password hash', async () => {
    const { create, service } = setup();
    const user = await create();

    const profile = await service.getProfile(user.id);
    const list = await service.findAll();

    expect(profile).not.toHaveProperty('password');
    expect(list[0]).not.toHaveProperty('password');
  });

  it('an unknown id is 404 (8001)', async () => {
    const { service } = setup();

    await expectUserNotFound(service.getProfile(UNKNOWN));
  });
});

describe('update', () => {
  it('changes only the fields that were sent', async () => {
    const { create, service } = setup();
    const user = await create({ organizationId: ORG });

    await service.update(user.id, { name: 'Jane Doe' });

    expect(await service.getProfile(user.id)).toMatchObject({
      name: 'Jane Doe',
      roleName: 'dispatcher',
      organizationId: ORG,
      isActive: true,
    });
  });

  it('changes the role', async () => {
    const { create, service } = setup();
    const user = await create({ roleName: 'driver' });

    await service.update(user.id, { roleName: 'support' });

    expect((await service.getProfile(user.id)).roleName).toBe('support');
  });

  it('an unknown role is 404 (7004) and nothing else in the request is applied', async () => {
    const { create, service } = setup();
    const user = await create({ roleName: 'driver' });

    await expectRoleNotFound(
      service.update(user.id, {
        roleName: 'superuser',
        name: 'Renamed',
        isActive: false,
      }),
    );
    expect(await service.getProfile(user.id)).toMatchObject({
      roleName: 'driver',
      name: 'Jane',
      isActive: true,
    });
  });

  it('organizationId: null takes the account out of its organization', async () => {
    const { create, service } = setup();
    const user = await create({ organizationId: ORG });

    await service.update(user.id, { organizationId: null });

    expect((await service.getProfile(user.id)).organizationId).toBeNull();
  });

  it('an unknown id is 404 (8001)', async () => {
    const { service } = setup();

    await expectUserNotFound(service.update(UNKNOWN, { name: 'x' }));
  });
});

describe('activate / deactivate (PATCH isActive)', () => {
  it('a deactivated account is refused on its very next request (401, 7003)', async () => {
    const { create, service, callAs } = setup();
    const admin = await create({ roleName: 'admin' });
    await expect(callAs(staffToken(admin.id), 'findAll')).resolves.toBe(true);

    await service.update(admin.id, { isActive: false });

    await expectDomainError(
      callAs(staffToken(admin.id), 'findAll'),
      InternalUserInactiveException,
      HttpStatus.UNAUTHORIZED,
      AccessControlErrorCodes.InternalUserInactive,
    );
  });

  it('reactivating lets the same account back in', async () => {
    const { create, service, callAs } = setup();
    const admin = await create({ roleName: 'admin' });
    await service.update(admin.id, { isActive: false });

    await service.update(admin.id, { isActive: true });

    await expect(callAs(staffToken(admin.id), 'findAll')).resolves.toBe(true);
  });

  it('deactivating keeps the role and organization, so reactivating restores them', async () => {
    const { create, service } = setup();
    const user = await create({ roleName: 'driver', organizationId: ORG });

    await service.update(user.id, { isActive: false });
    await service.update(user.id, { isActive: true });

    expect(await service.getProfile(user.id)).toMatchObject({
      roleName: 'driver',
      organizationId: ORG,
    });
  });

  it('demoting an admin takes away admin routes on the next request (403, 7001)', async () => {
    const { create, service, callAs } = setup();
    const admin = await create({ roleName: 'admin' });

    await service.update(admin.id, { roleName: 'dispatcher' });

    await expectDomainError(
      callAs(staffToken(admin.id), 'update'),
      InsufficientPermissionsException,
      HttpStatus.FORBIDDEN,
      AccessControlErrorCodes.InsufficientPermissions,
    );
  });
});

describe('route protection: every route is admin-only', () => {
  const methods = ['create', 'findAll', 'findOne', 'update'] as const;

  it.each(methods)('%s admits an admin', async (method) => {
    const { create, callAs } = setup();
    const admin = await create({ roleName: 'admin' });

    await expect(callAs(staffToken(admin.id), method)).resolves.toBe(true);
  });

  it.each(methods)('%s refuses a dispatcher (403, 7001)', async (method) => {
    const { create, callAs } = setup();
    const dispatcher = await create({ roleName: 'dispatcher' });

    await expectDomainError(
      callAs(staffToken(dispatcher.id), method),
      InsufficientPermissionsException,
      HttpStatus.FORBIDDEN,
      AccessControlErrorCodes.InsufficientPermissions,
    );
  });

  it.each(methods)('%s refuses a customer token (7002)', async (method) => {
    const { callAs } = setup();

    const error = await rejection(
      callAs(
        {
          id: 'customer-1',
          email: 'c@example.com',
          accountType: AccountType.CUSTOMER,
        },
        method,
      ),
    );

    expect((error as DomainException).code).toBe(
      AccessControlErrorCodes.NotInternalUser,
    );
  });
});

describe('current gaps (pinned, not endorsed)', () => {
  // Fixed by 6706f1e on backend_test_suite (not on main yet). Once that is
  // merged this test fails: replace it with "stores the email lowercased".
  it('a mixed-case email is stored as typed, but findByEmail lowercases, so that account can never be found to log in', async () => {
    const { create, service } = setup();

    const user = await create({ email: 'Jane.Doe@Example.com' });

    expect(user.email).toBe('Jane.Doe@Example.com');
    await expect(
      service.findByEmail('Jane.Doe@Example.com'),
    ).resolves.toBeNull();
  });

  it('creating with an organization that does not exist fails as a raw DB error (500), not 404', async () => {
    const { create, users } = setup();

    const error = await rejection(create({ organizationId: UNKNOWN }));

    expect(error).toBeInstanceOf(QueryFailedError);
    expect(users).toHaveLength(0);
  });

  it('moving an account to an organization that does not exist fails as a raw DB error (500), not 404', async () => {
    const { create, service } = setup();
    const user = await create();

    const error = await rejection(
      service.update(user.id, { organizationId: UNKNOWN }),
    );

    expect(error).toBeInstanceOf(QueryFailedError);
  });

  it('the last active admin can deactivate themselves, after which nobody can reach the admin routes', async () => {
    const { create, service, callAs } = setup();
    const admin = await create({ roleName: 'admin' });

    await service.update(admin.id, { isActive: false });

    const error = await rejection(callAs(staffToken(admin.id), 'update'));
    expect((error as DomainException).code).toBe(
      AccessControlErrorCodes.InternalUserInactive,
    );
    const admins = (await service.findAll()).filter(
      (user) => user.roleName === 'admin' && user.isActive,
    );
    expect(admins).toHaveLength(0);
  });

  it('the last admin can also demote themselves to a non-admin role', async () => {
    const { create, service } = setup();
    const admin = await create({ roleName: 'admin' });

    await service.update(admin.id, { roleName: 'driver' });

    expect(
      (await service.findAll()).some((user) => user.roleName === 'admin'),
    ).toBe(false);
  });
});
