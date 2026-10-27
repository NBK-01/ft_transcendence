import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { AccessControlService } from '../access-control/access-control.service';
import { Role } from '../access-control/entities/role.entity';
import { AccountType } from '../common/context/auth-context.types';
import { CryptoService } from '../common/services/crypto.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { InternalUser } from '../internal-users/internal-user.entity';
import { InternalUserErrorCodes } from '../internal-users/exceptions';
import { InternalUsersService } from '../internal-users/internal-users.service';
import { ActionSignals } from '../notifications/action-signals';
import { Organization } from '../organizations/organization.entity';
import { StaffProfileService } from './staff-profile.service';
import { ContactsService } from '../contacts/contacts.service';
import { PresenceService } from '../chat/presence.service';

/**
 * A staff member's own name and photo, and a colleague's profile. Runs the
 * real StaffProfileService and InternalUsersService (renameSelf, setAvatar,
 * findWithBranch) over an in-memory internal_user table; storage and
 * permissions are fakes.
 */

const BRANCH = Object.assign(new Organization(), {
  id: 'org-1',
  name: 'Beirut Central',
  isActive: true,
});

function setup() {
  const users: InternalUser[] = [
    Object.assign(new InternalUser(), {
      id: 'rami',
      email: 'rami@example.com',
      name: 'Rami Khoury',
      isActive: true,
      role: Object.assign(new Role(), {
        id: 'role-dispatcher',
        name: 'dispatcher',
      }),
      organizationId: BRANCH.id,
      organization: BRANCH,
      avatarKey: null,
      createdAt: new Date('2026-09-01T09:00:00Z'),
    }),
  ];
  const repository = {
    findOne: ({ where }: { where: { id: string } }) =>
      Promise.resolve(users.find((user) => user.id === where.id) ?? null),
    update: (id: string, values: Partial<InternalUser>) => {
      const row = users.find((user) => user.id === id);
      if (row) Object.assign(row, values);
      return Promise.resolve({ affected: row ? 1 : 0 });
    },
  };
  const signals: Array<{ event: string; payload: unknown }> = [];
  const events = new EventEmitter2({ wildcard: true });
  events.onAny((event, payload) =>
    signals.push({ event: String(event), payload }),
  );
  const internalUsers = new InternalUsersService(
    repository as unknown as Repository<InternalUser>,
    {} as Repository<Role>,
    {} as CryptoService,
    events,
  );
  const storage = {
    uploads: [] as string[],
    deleted: [] as string[],
    failDelete: false,
    uploadAvatar: (_buffer: Buffer, userId: string) => {
      const key = `avatars/${userId}-${storage.uploads.length + 1}.png`;
      storage.uploads.push(key);
      return Promise.resolve({ url: `https://signed/${key}`, key });
    },
    getAvatarUrl: (key: string) => Promise.resolve(`https://signed/${key}`),
    deleteFile: (key: string) => {
      if (storage.failDelete) return Promise.reject(new Error('S3 down'));
      storage.deleted.push(key);
      return Promise.resolve();
    },
  };
  /** Pairs in accepted contact, as "a:b", and who's online. */
  const contacts = new Set<string>();
  const online = new Set<string>();
  const service = new StaffProfileService(
    internalUsers,
    {
      getEffectivePermissions: () =>
        Promise.resolve(['shipments:read:org', 'shipments:update:org']),
    } as unknown as AccessControlService,
    storage as unknown as FileStorageService,
    {
      areConnected: (a: string, b: string) =>
        Promise.resolve(contacts.has(`${a}:${b}`) || contacts.has(`${b}:${a}`)),
    } as unknown as ContactsService,
    {
      isOnline: (_type: AccountType, id: string) =>
        Promise.resolve(online.has(id)),
    } as unknown as PresenceService,
  );
  return { service, users, storage, signals, contacts, online };
}

const photo = {
  buffer: Buffer.from('png'),
  originalname: 'me.png',
  mimetype: 'image/png',
} as Express.Multer.File;

const profileSignal = (change: 'details' | 'avatar') => ({
  event: ActionSignals.PROFILE_UPDATED,
  payload: { accountType: AccountType.STAFF, accountId: 'rami', change },
});

describe('StaffProfileService.me', () => {
  it('is the account as it is now, with its branch, permissions and no photo yet', async () => {
    const { service } = setup();

    await expect(service.me('rami')).resolves.toEqual({
      id: 'rami',
      email: 'rami@example.com',
      name: 'Rami Khoury',
      roleName: 'dispatcher',
      organizationId: 'org-1',
      organization: { id: 'org-1', name: 'Beirut Central', isActive: true },
      avatarUrl: null,
      permissions: ['shipments:read:org', 'shipments:update:org'],
    });
  });

  it('an unknown id is 404 (8001)', async () => {
    const { service } = setup();

    await expect(service.me('ghost')).rejects.toMatchObject({
      code: InternalUserErrorCodes.InternalUserNotFound,
    });
  });
});

describe('StaffProfileService: your own name and photo', () => {
  it('renames you, with a record for you; the same name changes nothing', async () => {
    const { service, users, signals } = setup();

    await expect(service.rename('rami', 'Rami K.')).resolves.toMatchObject({
      name: 'Rami K.',
    });
    await service.rename('rami', 'Rami K.');

    expect(users[0]!.name).toBe('Rami K.');
    expect(signals).toEqual([profileSignal('details')]);
  });

  it('a new photo replaces the old one, which is deleted from storage', async () => {
    const { service, users, storage, signals } = setup();

    await service.uploadAvatar('rami', photo);
    const second = await service.uploadAvatar('rami', photo);

    expect(second).toEqual({ avatarUrl: 'https://signed/avatars/rami-2.png' });
    expect(users[0]!.avatarKey).toBe('avatars/rami-2.png');
    expect(storage.deleted).toEqual(['avatars/rami-1.png']);
    expect(signals).toEqual([profileSignal('avatar'), profileSignal('avatar')]);
    await expect(service.me('rami')).resolves.toMatchObject({
      avatarUrl: 'https://signed/avatars/rami-2.png',
    });
  });

  it('removing it goes back to the initials; removing nothing is fine and says nothing', async () => {
    const { service, users, storage, signals } = setup();
    await service.uploadAvatar('rami', photo);
    signals.length = 0;

    await expect(service.removeAvatar('rami')).resolves.toEqual({
      avatarUrl: null,
    });
    await service.removeAvatar('rami');

    expect(users[0]!.avatarKey).toBeNull();
    expect(storage.deleted).toEqual(['avatars/rami-1.png']);
    expect(signals).toEqual([profileSignal('avatar')]);
  });

  it('a failed clean-up of the old photo doesn’t fail the upload', async () => {
    const { service, storage } = setup();
    await service.uploadAvatar('rami', photo);
    storage.failDelete = true;

    await expect(service.uploadAvatar('rami', photo)).resolves.toEqual({
      avatarUrl: 'https://signed/avatars/rami-2.png',
    });
  });
});

describe("StaffProfileService.profileOf: a colleague's page", () => {
  it('shows what any staff member may see: no permissions, no branch status, and no online status to a non-contact', async () => {
    const { service, online } = setup();
    online.add('rami');

    await expect(service.profileOf('nadia', 'rami')).resolves.toEqual({
      id: 'rami',
      name: 'Rami Khoury',
      email: 'rami@example.com',
      roleName: 'dispatcher',
      organization: { id: 'org-1', name: 'Beirut Central' },
      avatarUrl: null,
      isActive: true,
      online: null,
      createdAt: new Date('2026-09-01T09:00:00Z'),
    });
  });

  it('shows whether they are online to their accepted contacts, and to themselves', async () => {
    const { service, contacts, online } = setup();
    contacts.add('nadia:rami');

    await expect(service.profileOf('nadia', 'rami')).resolves.toMatchObject({
      online: false,
    });
    online.add('rami');
    await expect(service.profileOf('nadia', 'rami')).resolves.toMatchObject({
      online: true,
    });
    await expect(service.profileOf('rami', 'rami')).resolves.toMatchObject({
      online: true,
    });
  });
});
