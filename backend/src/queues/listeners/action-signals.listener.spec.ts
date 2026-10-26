import { AccountType } from '../../common/context/auth-context.types';
import { NotificationType } from '../../notifications/constants/notification.constants';
import { ActionLookupService } from '../../notifications/action-lookup.service';
import { ActionNotificationEvent } from '../events/action-notification.event';
import { ActionNotifier } from '../services/action-notifier.service';
import { ActionSignalsListener } from './action-signals.listener';

const ADMIN = { id: 'admin-1', accountType: AccountType.STAFF };
const ORG_UPDATED_AT = new Date('2026-10-25T10:00:00.000Z');
const STAFF_UPDATED_AT = new Date('2026-10-25T11:00:00.000Z');

describe('ActionSignalsListener', () => {
  let built: Array<ActionNotificationEvent | null>;
  let actor: typeof ADMIN | null;
  let lookup: Record<string, jest.Mock>;
  let listener: ActionSignalsListener;

  beforeEach(() => {
    built = [];
    actor = ADMIN;
    const notifier = {
      actor: () => actor,
      notify: (build: () => Promise<ActionNotificationEvent | null>) => {
        void build().then((event) => built.push(event));
      },
    } as unknown as ActionNotifier;
    lookup = {
      findOrganization: jest.fn(async () => ({
        id: 'org-1',
        name: 'Beirut Central',
        updatedAt: ORG_UPDATED_AT,
      })),
      findBranchStaffIds: jest.fn(async () => ['member-1', 'member-2']),
      findAccountUpdatedAt: jest.fn(async () => STAFF_UPDATED_AT),
    };
    listener = new ActionSignalsListener(
      notifier,
      lookup as unknown as ActionLookupService,
    );
  });

  const settle = () => new Promise(setImmediate);

  it('a branch deleted (deactivated): its name and staff as of now, the id and updatedAt as the occurrence', async () => {
    listener.onOrganizationDeactivated({ organizationId: 'org-1' });
    await settle();

    expect(built).toEqual([
      {
        type: NotificationType.BRANCH_DEACTIVATED,
        occurrence: `org-1-${ORG_UPDATED_AT.getTime()}`,
        actor: ADMIN,
        data: {
          organizationId: 'org-1',
          name: 'Beirut Central',
          staffIds: ['member-1', 'member-2'],
        },
      },
    ]);
  });

  it.each([
    ['onStaffAdded', NotificationType.BRANCH_STAFF_ADDED],
    ['onStaffRemoved', NotificationType.BRANCH_STAFF_REMOVED],
  ] as const)(
    '%s is %s, keyed by the staff row it changed',
    async (method, type) => {
      listener[method]({ organizationId: 'org-1', internalUserId: 'member-1' });
      await settle();

      expect(built).toEqual([
        {
          type,
          occurrence: `member-1-${STAFF_UPDATED_AT.getTime()}`,
          actor: ADMIN,
          data: {
            organizationId: 'org-1',
            name: 'Beirut Central',
            internalUserId: 'member-1',
          },
        },
      ]);
    },
  );

  it('a password change: the account, and no actor for a reset (no one signed in)', async () => {
    actor = null;
    listener.onPasswordChanged({
      accountType: AccountType.CUSTOMER,
      accountId: 'customer-1',
    });
    await settle();

    expect(lookup.findAccountUpdatedAt).toHaveBeenCalledWith({
      id: 'customer-1',
      accountType: AccountType.CUSTOMER,
    });
    expect(built).toEqual([
      {
        type: NotificationType.PASSWORD_CHANGED,
        occurrence: `customer-1-${STAFF_UPDATED_AT.getTime()}`,
        actor: null,
        data: {
          account: { id: 'customer-1', accountType: AccountType.CUSTOMER },
        },
      },
    ]);
  });

  it('says nothing when the row is gone by then', async () => {
    lookup.findOrganization.mockResolvedValue(null);
    listener.onOrganizationDeactivated({ organizationId: 'org-1' });
    listener.onStaffAdded({ organizationId: 'org-1', internalUserId: 'm' });
    await settle();

    expect(built).toEqual([null, null]);
  });
});

describe('ActionSignalsListener: API keys', () => {
  it('an API key created or revoked: the masked key as it was then, an occurrence each', async () => {
    const built: Array<ActionNotificationEvent | null> = [];
    const notifier = {
      actor: () => ADMIN,
      notify: (build: () => Promise<ActionNotificationEvent | null>) => {
        void build().then((event) => built.push(event));
      },
    } as unknown as ActionNotifier;
    const listener = new ActionSignalsListener(
      notifier,
      {} as ActionLookupService,
    );
    const key = {
      apiKeyId: 'key-1',
      name: 'Carrier sync',
      organizationId: 'org-1',
      branchName: 'Beirut Central',
      maskedKey: 'stk_9f3a…c4d2',
    };

    listener.onApiKeyCreated(key);
    listener.onApiKeyRevoked(key);
    await new Promise(setImmediate);

    expect(built).toEqual([
      {
        type: NotificationType.API_KEY_CREATED,
        occurrence: 'key-1',
        actor: ADMIN,
        data: key,
      },
      {
        type: NotificationType.API_KEY_REVOKED,
        occurrence: 'key-1-revoked',
        actor: ADMIN,
        data: key,
      },
    ]);
  });
});
