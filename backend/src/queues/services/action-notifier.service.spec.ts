import { AuthContextService } from '../../common/context/auth-context.service';
import { AccountType } from '../../common/context/auth-context.types';
import { NotificationType } from '../../notifications/constants/notification.constants';
import { ActionNotificationEvent } from '../events/action-notification.event';
import { ActionNotifier } from './action-notifier.service';
import { QueueService } from './queue.service';

const EVENT: ActionNotificationEvent = {
  type: NotificationType.BRANCH_CREATED,
  occurrence: 'org-1',
  actor: null,
  data: { organizationId: 'org-1', name: 'Beirut Central' },
};

describe('ActionNotifier', () => {
  let enqueue: jest.Mock;
  let user: { id: string; email: string; accountType: AccountType } | undefined;
  let notifier: ActionNotifier;

  beforeEach(() => {
    enqueue = jest.fn().mockResolvedValue(undefined);
    user = undefined;
    notifier = new ActionNotifier(
      { enqueue } as unknown as QueueService,
      { getUser: () => user } as unknown as AuthContextService,
    );
  });

  const settle = () => new Promise(setImmediate);

  it('the actor is the signed-in account, or nobody outside a request', () => {
    expect(notifier.actor()).toBeNull();
    user = { id: 'admin-1', email: 'a@x.test', accountType: AccountType.STAFF };
    expect(notifier.actor()).toEqual({
      id: 'admin-1',
      accountType: AccountType.STAFF,
    });
  });

  it('enqueues the built event as an ACTION_NOTIFICATION job, and nothing when it builds null', async () => {
    notifier.notify(async () => EVENT);
    notifier.notify(async () => null);
    await settle();

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith('ACTION_NOTIFICATION', EVENT);
  });

  it('logs a failure instead of throwing (the write it follows is done)', async () => {
    const logged = jest
      .spyOn(notifier['logger'], 'error')
      .mockImplementation(() => {});
    enqueue.mockRejectedValue(new Error('Redis is down'));

    expect(() => notifier.notify(async () => EVENT)).not.toThrow();
    notifier.notify(() => Promise.reject(new Error('lookup failed')));
    await settle();

    expect(logged).toHaveBeenCalledTimes(2);
  });
});
