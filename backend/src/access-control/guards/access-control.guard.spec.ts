import { ExecutionContext, RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { readdirSync } from 'fs';
import { join } from 'path';
import { AuthContextService } from '../../common/context';
import {
  AccountType,
  RequestUser,
} from '../../common/context/auth-context.types';
import {
  RequireAllPermissions,
  RequireAnyOf,
  RequireAnyPermission,
  RequireAnyRole,
  RequireCustomer,
  RequirePermission,
  RequireRole,
  RequireStaff,
  SkipAccessControl,
} from '../../common/decorators/access-control.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AccessControlService } from '../access-control.service';
import { AccessControlErrorCodes } from '../exceptions';
import { AccessControlGuard } from './access-control.guard';

/**
 * AccessControlGuard deliberately FAILS OPEN: a route with no access-control
 * decorator lets any authenticated token through (customer or staff). These
 * tests pin that down — and list every real route that is open today, so a
 * new staff route that forgot @RequireStaff() can't slip in unnoticed.
 */

type Handler = () => void;

class Routes {
  open() {}

  @SkipAccessControl()
  @RequirePermission('a')
  skipped() {}

  @RequireStaff()
  staff() {}

  @RequireCustomer()
  customer() {}

  @RequirePermission('a')
  permission() {}

  @RequireAnyPermission(['a', 'b'])
  anyPermission() {}

  @RequireAllPermissions(['a', 'b'])
  allPermissions() {}

  @RequireRole('manager')
  role() {}

  @RequireAnyRole(['manager', 'dispatcher'])
  anyRole() {}

  @RequireAnyOf(['manager', 'a'])
  anyOf() {}

  @RequirePermission('a')
  @RequireRole('manager')
  permissionAndRole() {}
}

@RequireStaff()
class StaffRoutes {
  inherits() {}

  @RequirePermission('a')
  overrides() {}

  @SkipAccessControl()
  skipped() {}
}

const customer: RequestUser = {
  id: 'customer-1',
  email: 'client@test.com',
  accountType: AccountType.CUSTOMER,
};
const staff = (id: string): RequestUser => ({
  id,
  email: `${id}@example.com`,
  accountType: AccountType.STAFF,
});

/** Who exists in internal_user, and what they hold. */
const DIRECTORY: Record<
  string,
  {
    isActive: boolean;
    admin?: boolean;
    roles?: string[];
    permissions?: string[];
  }
> = {
  'plain-staff': { isActive: true },
  'inactive-staff': { isActive: false, permissions: ['a', 'b'] },
  admin: { isActive: true, admin: true },
  'has-a': { isActive: true, permissions: ['a'] },
  'has-a-b': { isActive: true, permissions: ['a', 'b'] },
  manager: { isActive: true, roles: ['manager'] },
  'manager-with-a': { isActive: true, roles: ['manager'], permissions: ['a'] },
};

function setup(user: RequestUser | null) {
  const calls: string[] = [];
  const entry = (id: string) => DIRECTORY[id];
  const record =
    <A extends unknown[], R>(name: string, run: (...args: A) => R) =>
    (...args: A): Promise<R> => {
      calls.push(name);
      return Promise.resolve(run(...args));
    };
  const has = (list: string[] | undefined, wanted: string[]) =>
    wanted.map((value) => (list ?? []).includes(value));

  const accessControl = {
    getActiveInternalUser: record('getActiveInternalUser', (id: string) =>
      entry(id) ? { id, isActive: entry(id).isActive } : null,
    ),
    isAdmin: record('isAdmin', (id: string) => !!entry(id)?.admin),
    hasPermission: record('hasPermission', (id: string, name: string) =>
      has(entry(id)?.permissions, [name]).every(Boolean),
    ),
    hasAnyPermission: record(
      'hasAnyPermission',
      (id: string, names: string[]) =>
        has(entry(id)?.permissions, names).some(Boolean),
    ),
    hasAllPermissions: record(
      'hasAllPermissions',
      (id: string, names: string[]) =>
        has(entry(id)?.permissions, names).every(Boolean),
    ),
    hasRole: record('hasRole', (id: string, name: string) =>
      has(entry(id)?.roles, [name]).every(Boolean),
    ),
    hasAnyRole: record('hasAnyRole', (id: string, names: string[]) =>
      has(entry(id)?.roles, names).some(Boolean),
    ),
  };
  const authContext = {
    requireUser: () => {
      calls.push('requireUser');
      if (!user) throw new Error('no authenticated user in context');
      return user;
    },
  };
  const guard = new AccessControlGuard(
    new Reflector(),
    accessControl as unknown as AccessControlService,
    authContext as unknown as AuthContextService,
  );
  const check = (controller: new () => object, method: string) =>
    guard.canActivate(contextFor(controller, method));
  return { check, calls };
}

function contextFor(controller: new () => object, method: string) {
  const handler = (controller.prototype as Record<string, Handler>)[method];
  return {
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

async function expectRefused(
  promise: Promise<unknown>,
  code: AccessControlErrorCodes,
): Promise<void> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toMatchObject({ code });
}

describe('an undecorated route fails OPEN', () => {
  it.each([
    ['a customer', customer],
    ['a staff member', staff('plain-staff')],
    ['staff with no internal_user row', staff('nobody')],
  ])('lets %s through', async (_label, user) => {
    await expect(setup(user).check(Routes, 'open')).resolves.toBe(true);
  });

  it('does not even look at the user, roles or permissions', async () => {
    const { check, calls } = setup(null);

    await expect(check(Routes, 'open')).resolves.toBe(true);

    expect(calls).toEqual([]);
  });

  it('@SkipAccessControl() opens a route even when other decorators are present', async () => {
    const { check, calls } = setup(customer);

    await expect(check(Routes, 'skipped')).resolves.toBe(true);
    await expect(check(StaffRoutes, 'skipped')).resolves.toBe(true);
    expect(calls).toEqual([]);
  });
});

describe('@RequireStaff()', () => {
  it('admits any active staff member, no role or permission needed', async () => {
    await expect(
      setup(staff('plain-staff')).check(Routes, 'staff'),
    ).resolves.toBe(true);
  });

  it('refuses a customer token (7002)', async () => {
    await expectRefused(
      setup(customer).check(Routes, 'staff'),
      AccessControlErrorCodes.NotInternalUser,
    );
  });

  it.each(['inactive-staff', 'nobody'])('refuses %s (7003)', async (id) => {
    await expectRefused(
      setup(staff(id)).check(Routes, 'staff'),
      AccessControlErrorCodes.InternalUserInactive,
    );
  });

  it('on the class, it covers every method without its own decorator', async () => {
    await expectRefused(
      setup(customer).check(StaffRoutes, 'inherits'),
      AccessControlErrorCodes.NotInternalUser,
    );
    await expect(
      setup(staff('plain-staff')).check(StaffRoutes, 'inherits'),
    ).resolves.toBe(true);
  });
});

describe('@RequireCustomer()', () => {
  it('admits a customer', async () => {
    await expect(setup(customer).check(Routes, 'customer')).resolves.toBe(true);
  });

  it.each(['plain-staff', 'admin'])(
    'refuses staff, even %s (7006)',
    async (id) => {
      await expectRefused(
        setup(staff(id)).check(Routes, 'customer'),
        AccessControlErrorCodes.NotCustomer,
      );
    },
  );
});

describe('roles and permissions', () => {
  it.each<[string, string, string[]]>([
    ['permission', 'a', ['has-a', 'has-a-b', 'manager-with-a']],
    ['anyPermission', 'a OR b', ['has-a', 'has-a-b', 'manager-with-a']],
    ['allPermissions', 'a AND b', ['has-a-b']],
    ['role', 'manager', ['manager', 'manager-with-a']],
    ['anyRole', 'manager OR dispatcher', ['manager', 'manager-with-a']],
    [
      'anyOf',
      'role manager OR permission a',
      ['has-a', 'has-a-b', 'manager', 'manager-with-a'],
    ],
    ['permissionAndRole', 'permission a AND role manager', ['manager-with-a']],
  ])('%s (%s): only the right staff get in', async (route, _rule, allowed) => {
    const activeStaff = Object.keys(DIRECTORY).filter(
      (id) => DIRECTORY[id].isActive && !DIRECTORY[id].admin,
    );
    for (const id of activeStaff) {
      const result = setup(staff(id)).check(Routes, route);
      if (allowed.includes(id)) {
        await expect(result).resolves.toBe(true);
      } else {
        await expectRefused(
          result,
          AccessControlErrorCodes.InsufficientPermissions,
        );
      }
    }
  });

  it.each(['permission', 'allPermissions', 'role', 'permissionAndRole'])(
    'an admin passes %s without holding it',
    async (route) => {
      await expect(setup(staff('admin')).check(Routes, route)).resolves.toBe(
        true,
      );
    },
  );

  it.each(['permission', 'role', 'anyOf'])(
    'a customer is refused %s before any permission lookup (7002)',
    async (route) => {
      const { check, calls } = setup(customer);

      await expectRefused(
        check(Routes, route),
        AccessControlErrorCodes.NotInternalUser,
      );

      expect(calls).toEqual(['requireUser']);
    },
  );

  it('an inactive staff member is refused even with the permission (7003)', async () => {
    await expectRefused(
      setup(staff('inactive-staff')).check(Routes, 'permission'),
      AccessControlErrorCodes.InternalUserInactive,
    );
  });

  it('a method decorator overrides the class one', async () => {
    await expectRefused(
      setup(staff('plain-staff')).check(StaffRoutes, 'overrides'),
      AccessControlErrorCodes.InsufficientPermissions,
    );
    await expect(
      setup(staff('has-a')).check(StaffRoutes, 'overrides'),
    ).resolves.toBe(true);
  });
});

/**
 * Every real route the guard lets through without checking anything, and why
 * that's OK. If this test fails, a route was added or changed: give a staff
 * route @RequireStaff() (or a role/permission) and a customer route
 * @RequireCustomer(), and only add it here if it really must accept any token.
 */
const OPEN_ROUTES: Record<string, string> = {
  // No token needed at all.
  'GET /health': 'public',
  'GET /health/live': 'public',
  'GET /health/ready': 'public',
  'GET /auth/google': 'public',
  'GET /auth/google/callback': 'public',
  'POST /auth/register': 'public',
  'POST /auth/verify-otp': 'public',
  'POST /auth/resend-otp': 'public',
  'POST /auth/login': 'public',
  'POST /auth/refresh': 'public',
  'POST /auth/logout': 'public',
  'POST /auth/oauth/exchange': 'public',
  'POST /auth/forgot-password': 'public',
  'POST /auth/reset-password': 'public',
  'POST /staff-auth/login': 'public',
  'POST /staff-auth/refresh': 'public',
  'POST /staff-auth/logout': 'public',

  // The caller's own account — only ever reads or changes the token's own user.
  'GET /auth/me': 'any signed-in user',
  'POST /auth/change-password': 'any signed-in user',
  'POST /auth/logout-all': 'any signed-in user',
  'GET /users/profile': 'any signed-in user',

  // Both customers and staff chat: ChatAccessService decides per conversation.
  'GET /chat/conversations': 'any signed-in user',
  'GET /chat/conversations/:id/messages': 'any signed-in user',
  'POST /chat/conversations/:id/messages': 'any signed-in user',
  'PATCH /chat/conversations/:id/read': 'any signed-in user',

  // The caller's own notifications — NotificationsService scopes every query to the caller's id.
  'GET /notifications': 'any signed-in user',
  'GET /notifications/unread-count': 'any signed-in user',
  'PATCH /notifications/:id/read': 'any signed-in user',
  'PATCH /notifications/read-all': 'any signed-in user',
  'DELETE /notifications/:id': 'any signed-in user',
};

describe('routes that are open today', () => {
  it('match the reviewed list', async () => {
    const open: Record<string, string> = {};
    for (const route of await allRoutes()) {
      const { check } = setup(null);
      const admitted = await check(route.controller, route.method).then(
        () => true,
        () => false,
      );
      if (admitted) open[route.name] = route.access;
    }

    expect(open).toEqual(OPEN_ROUTES);
  });
});

/** Every route of every *.controller.ts under src, with how it's protected besides this guard. */
async function allRoutes() {
  const srcDir = join(__dirname, '..', '..');
  const files = readdirSync(srcDir, {
    recursive: true,
    encoding: 'utf8',
  }).filter((file) => file.endsWith('.controller.ts'));
  const routes: {
    name: string;
    controller: new () => object;
    method: string;
    access: string;
  }[] = [];
  for (const file of files) {
    const exported = (await import(join(srcDir, file))) as Record<
      string,
      unknown
    >;
    for (const value of Object.values(exported)) {
      if (typeof value !== 'function') continue;
      const controller = value as new () => object;
      const base = Reflect.getMetadata(PATH_METADATA, controller) as
        string | undefined;
      if (base === undefined) continue;
      const proto = controller.prototype as Record<string, Handler>;
      for (const method of Object.getOwnPropertyNames(proto)) {
        const verb = Reflect.getMetadata(METHOD_METADATA, proto[method]) as
          RequestMethod | undefined;
        if (verb === undefined) continue;
        const path = Reflect.getMetadata(
          PATH_METADATA,
          proto[method],
        ) as string;
        const url = ['', base, path]
          .join('/')
          .replace(/\/+/g, '/')
          .replace(/(.)\/$/, '$1');
        routes.push({
          name: `${RequestMethod[verb]} ${url}`,
          controller,
          method,
          access: describeAccess(controller, proto[method]),
        });
      }
    }
  }
  return routes;
}

function describeAccess(
  controller: new () => object,
  handler: Handler,
): string {
  const targets = [handler, controller];
  if (new Reflector().getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
    return 'public';
  }
  const guards = targets.flatMap(
    (target) =>
      (Reflect.getMetadata(GUARDS_METADATA, target) as
        { name: string }[] | undefined) ?? [],
  );
  return guards.length
    ? `own guard: ${guards.map((guard) => guard.name).join(', ')}`
    : 'any signed-in user';
}
