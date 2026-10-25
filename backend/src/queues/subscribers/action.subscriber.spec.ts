import {
  DataSource,
  InsertEvent,
  ObjectLiteral,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  UpdateEvent,
} from 'typeorm';
import { AccountType } from '../../common/context/auth-context.types';
import { Organization } from '../../organizations/organization.entity';
import { InternalUser } from '../../internal-users/internal-user.entity';
import { Contact, ContactStatus } from '../../contacts/contact.entity';
import {
  Conversation,
  ConversationType,
} from '../../chat/entities/conversation.entity';
import { ShipmentFile } from '../../shipments/entities/shipment-file.entity';
import { ShipmentFileKind } from '../../shipments/constants/shipment-state';
import { NotificationType } from '../../notifications/constants/notification.constants';
import { ActionLookupService } from '../../notifications/action-lookup.service';
import { ActionNotificationEvent } from '../events/action-notification.event';
import { ActionNotifier } from '../services/action-notifier.service';
import { ActionSubscriber } from './action.subscriber';

const ADMIN = { id: 'admin-1', accountType: AccountType.STAFF };
const UPDATED_AT = new Date('2026-10-25T10:00:00.000Z');

let built: Array<ActionNotificationEvent | null>;
let notify: jest.Mock;
let subscriber: ActionSubscriber;
let queryRunner: { isTransactionActive: boolean; data: ObjectLiteral };

beforeEach(() => {
  built = [];
  notify = jest.fn(async (build: () => Promise<ActionNotificationEvent>) => {
    built.push(await build());
  });
  const notifier = {
    actor: () => ADMIN,
    notify,
  } as unknown as ActionNotifier;
  const lookup = {
    findBranchStaffIds: jest.fn(async () => ['member-1']),
  } as unknown as ActionLookupService;
  subscriber = new ActionSubscriber(
    { subscribers: [] } as unknown as DataSource,
    notifier,
    lookup,
  );
  queryRunner = { isTransactionActive: true, data: {} };
});

const insert = (target: unknown, entity: ObjectLiteral) =>
  subscriber.afterInsert({
    metadata: { target },
    entity,
    queryRunner,
  } as unknown as InsertEvent<ObjectLiteral>);
const update = (
  target: unknown,
  databaseEntity: ObjectLiteral | undefined,
  entity: ObjectLiteral,
) =>
  subscriber.afterUpdate({
    metadata: { target },
    databaseEntity,
    entity,
    queryRunner,
  } as unknown as UpdateEvent<ObjectLiteral>);
const commit = async () => {
  queryRunner.isTransactionActive = false;
  subscriber.afterTransactionCommit({
    queryRunner,
  } as unknown as TransactionCommitEvent);
  await new Promise(setImmediate);
};
const rollback = () => {
  queryRunner.isTransactionActive = false;
  subscriber.afterTransactionRollback({
    queryRunner,
  } as unknown as TransactionRollbackEvent);
};

const org = (changes: Partial<Organization> = {}) => ({
  id: 'org-1',
  name: 'Beirut Central',
  description: null,
  contactEmail: null,
  isActive: true,
  updatedAt: UPDATED_AT,
  ...changes,
});
const member = (changes: Partial<InternalUser> = {}) => ({
  id: 'member-1',
  name: 'Rami Khoury',
  roleId: 'role-dispatcher',
  organizationId: 'org-1',
  isActive: true,
  updatedAt: UPDATED_AT,
  ...changes,
});

describe('ActionSubscriber: inserts and transactions', () => {
  it('notifies only once the transaction commits, with who acted', async () => {
    insert(Organization, org());
    expect(notify).not.toHaveBeenCalled();

    await commit();

    expect(built).toEqual([
      {
        type: NotificationType.BRANCH_CREATED,
        occurrence: 'org-1',
        actor: ADMIN,
        data: { organizationId: 'org-1', name: 'Beirut Central' },
      },
    ]);
  });

  it('notifies nobody when the transaction rolls back', async () => {
    insert(Organization, org());
    rollback();
    await commit();

    expect(notify).not.toHaveBeenCalled();
  });

  it.each([
    [InternalUser, member(), NotificationType.STAFF_ACCOUNT_CREATED],
    [Contact, { id: 'contact-1' }, NotificationType.CONTACT_REQUEST_RECEIVED],
    [
      Conversation,
      { id: 'c-1', type: ConversationType.SUPPORT, customerId: 'customer-1' },
      NotificationType.SUPPORT_CONVERSATION_STARTED,
    ],
    [
      ShipmentFile,
      {
        id: 'file-1',
        shipmentId: 'shipment-1',
        kind: ShipmentFileKind.PROOF_OF_DELIVERY,
        name: 'proof.pdf',
      },
      NotificationType.SHIPMENT_FILE_ADDED,
    ],
  ])('an insert into %p is %s', async (target, entity, type) => {
    insert(target, entity);
    await commit();

    expect(built).toEqual([expect.objectContaining({ type, actor: ADMIN })]);
  });

  it('says nothing for a staff DM, a request photo or an offer photo', async () => {
    insert(Conversation, { id: 'c-2', type: ConversationType.STAFF_DM });
    for (const kind of [
      ShipmentFileKind.REQUEST_PHOTO,
      ShipmentFileKind.OFFER_PHOTO,
    ]) {
      insert(ShipmentFile, { id: `file-${kind}`, shipmentId: 's', kind });
    }
    await commit();

    expect(notify).not.toHaveBeenCalled();
  });
});

describe('ActionSubscriber: branch changes', () => {
  it('a deactivation, with the staff taken after the commit', async () => {
    update(Organization, org(), org({ isActive: false }));
    await commit();

    expect(built).toEqual([
      {
        type: NotificationType.BRANCH_DEACTIVATED,
        occurrence: `org-1-${UPDATED_AT.getTime()}`,
        actor: ADMIN,
        data: {
          organizationId: 'org-1',
          name: 'Beirut Central',
          staffIds: ['member-1'],
        },
      },
    ]);
  });

  it.each([
    ['name', org({ name: 'Beirut Port' })],
    ['description', org({ description: 'Main hub' })],
    ['contact email', org({ contactEmail: 'beirut@shiptrack.example' })],
  ])('an update of its %s', async (_field, after) => {
    update(Organization, org(), after);
    await commit();

    expect(built).toEqual([
      expect.objectContaining({ type: NotificationType.BRANCH_UPDATED }),
    ]);
  });

  it('a reactivation is an update; saving it unchanged says nothing', async () => {
    update(Organization, org({ isActive: false }), org());
    update(Organization, org(), org());
    await commit();

    expect(built).toEqual([
      expect.objectContaining({ type: NotificationType.BRANCH_UPDATED }),
    ]);
  });

  it('repository.update() (no old values) is left to the signals', async () => {
    update(Organization, undefined, { isActive: false });
    await commit();

    expect(notify).not.toHaveBeenCalled();
  });
});

describe('ActionSubscriber: staff account changes', () => {
  it('a deactivation', async () => {
    update(InternalUser, member(), member({ isActive: false }));
    await commit();

    expect(built).toEqual([
      expect.objectContaining({
        type: NotificationType.STAFF_ACCOUNT_DEACTIVATED,
        data: { internalUserId: 'member-1', name: 'Rami Khoury' },
      }),
    ]);
  });

  it('lists what changed: role, branch, name, reactivated', async () => {
    update(
      InternalUser,
      member({ isActive: false }),
      member({ roleId: 'role-admin', organizationId: null, name: 'Rami K.' }),
    );
    await commit();

    expect(built).toEqual([
      expect.objectContaining({
        type: NotificationType.STAFF_ACCOUNT_UPDATED,
        data: {
          internalUserId: 'member-1',
          name: 'Rami K.',
          changed: ['role', 'branch', 'name', 'reactivated'],
        },
      }),
    ]);
  });

  it('says nothing for other changes, e.g. a sign-out everywhere', async () => {
    update(InternalUser, member(), member({ forceLogoutAfter: new Date() }));
    await commit();

    expect(notify).not.toHaveBeenCalled();
  });
});

describe('ActionSubscriber: contacts', () => {
  const contact = (status: ContactStatus) => ({
    id: 'contact-1',
    status,
    updatedAt: UPDATED_AT,
  });

  it('an accepted request', async () => {
    update(
      Contact,
      contact(ContactStatus.PENDING),
      contact(ContactStatus.ACCEPTED),
    );
    await commit();

    expect(built).toEqual([
      {
        type: NotificationType.CONTACT_REQUEST_ACCEPTED,
        occurrence: 'contact-1-accepted',
        actor: ADMIN,
        data: { contactId: 'contact-1' },
      },
    ]);
  });

  it('a block notifies nobody (declines and removals delete the row: no update at all)', async () => {
    update(
      Contact,
      contact(ContactStatus.PENDING),
      contact(ContactStatus.BLOCKED),
    );
    update(
      Contact,
      contact(ContactStatus.ACCEPTED),
      contact(ContactStatus.BLOCKED),
    );
    await commit();

    expect(notify).not.toHaveBeenCalled();
  });
});
