import { HttpStatus } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { AccessControlService } from '../access-control/access-control.service';
import { RolePermission } from '../access-control/entities/role-permission.entity';
import { Role } from '../access-control/entities/role.entity';
import { ACCESS_CONTROL_KEYS } from '../common/decorators/access-control.decorator';
import { DomainException } from '../common/exceptions/base/error-types';
import { CryptoService } from '../common/services/crypto.service';
import { InternalUser } from '../internal-users/internal-user.entity';
import { InternalUsersService } from '../internal-users/internal-users.service';
import { Contact, ContactStatus } from './contact.entity';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import {
  ContactAlreadyExistsException,
  ContactErrorCodes,
  ContactNotFoundException,
  ContactNotPendingException,
  ContactScopeViolationException,
  ContactSelfRequestException,
} from './exceptions';

/**
 * Staff contacts: send / accept / reject / block / remove, and the
 * organization scoping on who may send a request at all.
 *
 * Runs the real ContactsService, the real InternalUsersService and the real
 * AccessControlService (isAdmin) over in-memory `contact`, `internal_user`
 * and `role` tables. The contact table enforces the same UNIQUE
 * (requester_id, addressee_id) constraint as the entity.
 *
 * There is no "unblock" endpoint: DELETE /contacts/:id (remove) is the only
 * way a block goes away.
 *
 * The "current gaps" block pins behaviour that looks wrong but is what the
 * code does today, so a fix shows up as a deliberate test change.
 */

const BEIRUT = 'org-beirut';
const TRIPOLI = 'org-tripoli';

/** TypeORM semantics: an array `where` is OR, each object inside is AND. */
const matches = <T extends object>(
  row: T,
  where: Partial<T> | Partial<T>[],
): boolean =>
  (Array.isArray(where) ? where : [where]).some((condition) =>
    Object.entries(condition).every(
      ([key, value]) => row[key as keyof T] === value,
    ),
  );

function staffTable() {
  const roles = ['admin', 'dispatcher', 'driver'].map((name) =>
    Object.assign(new Role(), { id: `role-${name}`, name }),
  );
  const users: InternalUser[] = [];
  const withRole = (user: InternalUser) => {
    user.role = roles.find((role) => role.id === user.roleId);
    return user;
  };
  const userRepository = {
    findOne: ({ where }: { where: Partial<InternalUser> }) => {
      const row = users.find((user) => matches(user, where));
      return Promise.resolve(row ? withRole(row) : null);
    },
  };
  const add = (
    id: string,
    organizationId: string | null,
    role = 'dispatcher',
    isActive = true,
  ) =>
    users.push(
      Object.assign(new InternalUser(), {
        id,
        email: `${id}@example.com`,
        name: id,
        isActive,
        roleId: `role-${role}`,
        organizationId,
      }),
    );
  return { userRepository, users, add };
}

function setup() {
  const staff = staffTable();
  staff.add('alice', BEIRUT);
  staff.add('bob', BEIRUT);
  staff.add('carol', BEIRUT);
  staff.add('tom', TRIPOLI);
  staff.add('nora', null); // waiting for an organization, not an admin
  staff.add('admin', null, 'admin');
  staff.add('gone', BEIRUT, 'driver', false); // deactivated

  const contacts: Contact[] = [];
  let nextId = 1;
  const userById = (id: string) => staff.users.find((user) => user.id === id)!;
  const withParties = (contact: Contact) =>
    Object.assign(contact, {
      requester: userById(contact.requesterId),
      addressee: userById(contact.addresseeId),
    });

  const contactRepository = {
    findOne: ({ where }: { where: Partial<Contact> | Partial<Contact>[] }) =>
      Promise.resolve(contacts.find((row) => matches(row, where)) ?? null),
    findOneOrFail: ({ where }: { where: Partial<Contact> }) => {
      const row = contacts.find((contact) => matches(contact, where));
      return row
        ? Promise.resolve(withParties(row))
        : Promise.reject(new Error('EntityNotFound'));
    },
    find: ({ where }: { where: Partial<Contact>[] }) =>
      Promise.resolve(
        contacts.filter((row) => matches(row, where)).map(withParties),
      ),
    create: (values: Partial<Contact>) => Object.assign(new Contact(), values),
    save: async (contact: Contact) => {
      await Promise.resolve(); // let a racing request interleave
      const duplicate = contacts.some(
        (row) =>
          row !== contact &&
          row.requesterId === contact.requesterId &&
          row.addresseeId === contact.addresseeId,
      );
      if (duplicate) {
        return Promise.reject(
          new QueryFailedError(
            'INSERT INTO "contact"',
            [],
            Object.assign(new Error('duplicate key'), { code: '23505' }),
          ),
        );
      }
      if (!contact.id) {
        const now = new Date();
        Object.assign(contact, {
          id: `contact-${nextId++}`,
          createdAt: now,
          updatedAt: now,
        });
        contacts.push(contact);
      }
      return Promise.resolve(contact);
    },
    remove: (contact: Contact) => {
      contacts.splice(contacts.indexOf(contact), 1);
      return Promise.resolve(contact);
    },
  };

  const internalUsers = new InternalUsersService(
    staff.userRepository as unknown as Repository<InternalUser>,
    {} as Repository<Role>,
    {} as CryptoService,
  );
  const accessControl = new AccessControlService(
    staff.userRepository as unknown as Repository<InternalUser>,
    {} as Repository<Role>,
    {} as Repository<RolePermission>,
  );
  const service = new ContactsService(
    contactRepository as unknown as Repository<Contact>,
    internalUsers,
    accessControl,
  );

  /** A request from `from` to `to`, already moved to `status`. */
  const contactBetween = async (
    from: string,
    to: string,
    status = ContactStatus.PENDING,
  ) => {
    const { id } = await service.sendRequest(from, to);
    if (status === ContactStatus.ACCEPTED) await service.acceptRequest(id, to);
    if (status === ContactStatus.BLOCKED) await service.blockContact(id, to);
    return id;
  };

  return { service, contacts, contactBetween };
}

async function expectError(
  promise: Promise<unknown>,
  type: new (...args: never[]) => DomainException,
  status: HttpStatus,
  code: ContactErrorCodes,
): Promise<void> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(type);
  expect((error as DomainException).getStatus()).toBe(status);
  expect((error as DomainException).code).toBe(code);
}

const expectNotFound = (promise: Promise<unknown>) =>
  expectError(
    promise,
    ContactNotFoundException,
    HttpStatus.NOT_FOUND,
    ContactErrorCodes.ContactNotFound,
  );
const expectOutOfScope = (promise: Promise<unknown>) =>
  expectError(
    promise,
    ContactScopeViolationException,
    HttpStatus.FORBIDDEN,
    ContactErrorCodes.ContactScopeViolation,
  );
const expectAlreadyExists = (promise: Promise<unknown>) =>
  expectError(
    promise,
    ContactAlreadyExistsException,
    HttpStatus.CONFLICT,
    ContactErrorCodes.ContactAlreadyExists,
  );
const expectNotPending = (promise: Promise<unknown>) =>
  expectError(
    promise,
    ContactNotPendingException,
    HttpStatus.CONFLICT,
    ContactErrorCodes.ContactNotPending,
  );

describe('send a request', () => {
  it('between two staff of the same organization: pending, with both names', async () => {
    const { service } = setup();

    const contact = await service.sendRequest('alice', 'bob');

    expect(contact).toMatchObject({
      requesterId: 'alice',
      requesterName: 'alice',
      requesterEmail: 'alice@example.com',
      addresseeId: 'bob',
      addresseeName: 'bob',
      status: ContactStatus.PENDING,
    });
    await expect(service.areConnected('alice', 'bob')).resolves.toBe(false);
  });

  it.each([
    ['an admin to anyone', 'admin', 'tom'],
    ['anyone to an admin', 'tom', 'admin'],
    ['someone without an organization to an admin', 'nora', 'admin'],
  ])(
    'crosses organizations when one side is admin: %s',
    async (_l, from, to) => {
      const { service } = setup();

      await expect(service.sendRequest(from, to)).resolves.toMatchObject({
        status: ContactStatus.PENDING,
      });
    },
  );

  it.each([
    ['different organizations', 'alice', 'tom'],
    ['the sender has no organization (and is not admin)', 'nora', 'alice'],
    ['the receiver has no organization (and is not admin)', 'alice', 'nora'],
    ['the receiver does not exist', 'alice', 'ghost'],
  ])('is refused (403, 12003) when %s', async (_l, from, to) => {
    const { service, contacts } = setup();

    await expectOutOfScope(service.sendRequest(from, to));
    expect(contacts).toHaveLength(0);
  });

  it('to yourself is refused (400, 12004)', async () => {
    const { service } = setup();

    await expectError(
      service.sendRequest('alice', 'alice'),
      ContactSelfRequestException,
      HttpStatus.BAD_REQUEST,
      ContactErrorCodes.ContactSelfRequest,
    );
  });

  it.each([
    ['the same direction', 'alice', 'bob'],
    ['the opposite direction', 'bob', 'alice'],
  ])(
    'is refused (409, 12002) when a contact already exists in %s',
    async (_l, from, to) => {
      const { service, contactBetween, contacts } = setup();
      await contactBetween('alice', 'bob');

      await expectAlreadyExists(service.sendRequest(from, to));
      expect(contacts).toHaveLength(1);
    },
  );

  it('lets exactly one of two simultaneous requests for the same pair win, the other gets 409 (not a raw DB error)', async () => {
    const { service, contacts } = setup();

    const results = await Promise.allSettled([
      service.sendRequest('alice', 'bob'),
      service.sendRequest('alice', 'bob'),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const loser = results.find((result) => result.status === 'rejected');
    await expectAlreadyExists(
      Promise.reject((loser as PromiseRejectedResult).reason),
    );
    expect(contacts).toHaveLength(1);
  });
});

describe('accept', () => {
  it('the receiver accepts: status accepted and the two are connected both ways', async () => {
    const { service, contactBetween } = setup();
    const id = await contactBetween('alice', 'bob');

    const contact = await service.acceptRequest(id, 'bob');

    expect(contact.status).toBe(ContactStatus.ACCEPTED);
    await expect(service.areConnected('alice', 'bob')).resolves.toBe(true);
    await expect(service.areConnected('bob', 'alice')).resolves.toBe(true);
  });

  it.each([
    ['the sender', 'alice'],
    ['a stranger', 'carol'],
  ])(
    '%s cannot accept: 404, so the request is not revealed',
    async (_l, actor) => {
      const { service, contactBetween } = setup();
      const id = await contactBetween('alice', 'bob');

      await expectNotFound(service.acceptRequest(id, actor));
      await expect(service.areConnected('alice', 'bob')).resolves.toBe(false);
    },
  );

  it.each([ContactStatus.ACCEPTED, ContactStatus.BLOCKED])(
    'a contact that is already %s cannot be accepted (409, 12005)',
    async (status) => {
      const { service, contactBetween } = setup();
      const id = await contactBetween('alice', 'bob', status);

      await expectNotPending(service.acceptRequest(id, 'bob'));
    },
  );

  it('an unknown id is 404 (12001)', async () => {
    const { service } = setup();

    await expectNotFound(service.acceptRequest('contact-404', 'bob'));
  });
});

describe('reject', () => {
  it('the receiver rejects: the request is deleted, so it can be sent again later', async () => {
    const { service, contactBetween, contacts } = setup();
    const id = await contactBetween('alice', 'bob');

    await service.rejectRequest(id, 'bob');

    expect(contacts).toHaveLength(0);
    await expect(service.sendRequest('alice', 'bob')).resolves.toMatchObject({
      status: ContactStatus.PENDING,
    });
  });

  it.each([
    ['the sender', 'alice'],
    ['a stranger', 'carol'],
  ])('%s cannot reject (404) and the request stays', async (_l, actor) => {
    const { service, contactBetween, contacts } = setup();
    const id = await contactBetween('alice', 'bob');

    await expectNotFound(service.rejectRequest(id, actor));
    expect(contacts).toHaveLength(1);
  });

  it('an accepted contact cannot be rejected (409, 12005), it has to be removed', async () => {
    const { service, contactBetween } = setup();
    const id = await contactBetween('alice', 'bob', ContactStatus.ACCEPTED);

    await expectNotPending(service.rejectRequest(id, 'bob'));
    await expect(service.areConnected('alice', 'bob')).resolves.toBe(true);
  });
});

describe('block', () => {
  it.each([
    ['the receiver blocks a pending request', ContactStatus.PENDING, 'bob'],
    ['the sender blocks a pending request', ContactStatus.PENDING, 'alice'],
    ['either side blocks an accepted contact', ContactStatus.ACCEPTED, 'alice'],
  ])('%s', async (_l, status, actor) => {
    const { service, contactBetween } = setup();
    const id = await contactBetween('alice', 'bob', status);

    const contact = await service.blockContact(id, actor);

    expect(contact.status).toBe(ContactStatus.BLOCKED);
  });

  it('a blocked pair is no longer connected (chat sending is refused)', async () => {
    const { service, contactBetween } = setup();
    const id = await contactBetween('alice', 'bob', ContactStatus.ACCEPTED);

    await service.blockContact(id, 'bob');

    await expect(service.areConnected('alice', 'bob')).resolves.toBe(false);
  });

  it.each([
    ['the blocked side', 'alice', 'bob'],
    ['the blocking side', 'bob', 'alice'],
  ])(
    '%s cannot send a new request while blocked (409)',
    async (_l, from, to) => {
      const { service, contactBetween } = setup();
      await contactBetween('alice', 'bob', ContactStatus.BLOCKED);

      await expectAlreadyExists(service.sendRequest(from, to));
    },
  );

  it('a stranger cannot block (404) and nothing changes', async () => {
    const { service, contactBetween } = setup();
    const id = await contactBetween('alice', 'bob', ContactStatus.ACCEPTED);

    await expectNotFound(service.blockContact(id, 'carol'));
    await expect(service.areConnected('alice', 'bob')).resolves.toBe(true);
  });

  it('an unknown id is 404 (12001)', async () => {
    const { service } = setup();

    await expectNotFound(service.blockContact('contact-404', 'alice'));
  });
});

describe('remove', () => {
  it.each(['alice', 'bob'])(
    '%s can remove an accepted contact, which disconnects both',
    async (actor) => {
      const { service, contactBetween, contacts } = setup();
      const id = await contactBetween('alice', 'bob', ContactStatus.ACCEPTED);

      await service.removeContact(id, actor);

      expect(contacts).toHaveLength(0);
      await expect(service.areConnected('alice', 'bob')).resolves.toBe(false);
    },
  );

  it('the sender can cancel a pending request', async () => {
    const { service, contactBetween, contacts } = setup();
    const id = await contactBetween('alice', 'bob');

    await service.removeContact(id, 'alice');

    expect(contacts).toHaveLength(0);
  });

  it('a stranger cannot remove (404) and the contact stays', async () => {
    const { service, contactBetween, contacts } = setup();
    const id = await contactBetween('alice', 'bob', ContactStatus.ACCEPTED);

    await expectNotFound(service.removeContact(id, 'carol'));
    expect(contacts).toHaveLength(1);
  });
});

describe('list', () => {
  async function seed() {
    const ctx = setup();
    await ctx.contactBetween('alice', 'bob', ContactStatus.ACCEPTED);
    await ctx.contactBetween('carol', 'alice');
    await ctx.contactBetween('admin', 'alice', ContactStatus.BLOCKED);
    await ctx.contactBetween('bob', 'carol');
    return ctx;
  }
  const pairs = (list: { requesterId: string; addresseeId: string }[]) =>
    list.map((c) => `${c.requesterId}->${c.addresseeId}`).sort();

  it('shows only my contacts, whether I sent or received them', async () => {
    const { service } = await seed();

    expect(pairs(await service.listContacts('alice'))).toEqual([
      'admin->alice',
      'alice->bob',
      'carol->alice',
    ]);
  });

  it.each([
    [ContactStatus.ACCEPTED, ['alice->bob']],
    [ContactStatus.PENDING, ['carol->alice']],
    [ContactStatus.BLOCKED, ['admin->alice']],
  ])('filters by status %s', async (status, expected) => {
    const { service } = await seed();

    expect(pairs(await service.listContacts('alice', status))).toEqual(
      expected,
    );
  });

  it('someone with no contacts gets an empty list', async () => {
    const { service } = await seed();

    await expect(service.listContacts('tom')).resolves.toEqual([]);
  });
});

describe('route protection', () => {
  it('the whole controller is staff-only, no route opts out', () => {
    expect(
      Reflect.getMetadata(ACCESS_CONTROL_KEYS.STAFF, ContactsController),
    ).toBe(true);

    const proto = ContactsController.prototype as unknown as Record<
      string,
      object
    >;
    for (const method of Object.getOwnPropertyNames(proto)) {
      if (method === 'constructor') continue;
      expect(
        Reflect.getMetadata(ACCESS_CONTROL_KEYS.SKIP, proto[method]),
      ).toBeUndefined();
      expect(
        Reflect.getMetadata(ACCESS_CONTROL_KEYS.CUSTOMER, proto[method]),
      ).toBeUndefined();
    }
  });
});

describe('current gaps (pinned, not endorsed)', () => {
  it('the BLOCKED person can lift the block themselves by removing the contact, then ask again', async () => {
    const { service, contactBetween } = setup();
    // Bob blocks Alice's request…
    const id = await contactBetween('alice', 'bob', ContactStatus.BLOCKED);

    // …but the row doesn't record who blocked, and remove is open to either side.
    await service.removeContact(id, 'alice');
    const again = await service.sendRequest('alice', 'bob');

    expect(again.status).toBe(ContactStatus.PENDING);
  });

  it('the blocked person sees the block, and can "block" back (no record of who blocked)', async () => {
    const { service, contactBetween } = setup();
    const id = await contactBetween('alice', 'bob', ContactStatus.BLOCKED);

    expect(
      (await service.listContacts('alice', ContactStatus.BLOCKED)).map(
        (c) => c.id,
      ),
    ).toEqual([id]);
    await expect(service.blockContact(id, 'alice')).resolves.toMatchObject({
      status: ContactStatus.BLOCKED,
    });
  });

  it('a request can be sent to a deactivated staff account', async () => {
    const { service } = setup();

    await expect(service.sendRequest('alice', 'gone')).resolves.toMatchObject({
      status: ContactStatus.PENDING,
    });
  });
});
