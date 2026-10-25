import { NotificationStatus } from '../../notifications/constants/notification.constants';
import { Notification } from '../../notifications/entities/notification.entity';
import { CreateNotificationInput } from '../../notifications/notifications.service';
import { JobServices } from '../interfaces/job-handler.interface';

/**
 * Delivery is local-only for now: the row in the recipient's feed is the
 * notification, so once it's saved it's delivered. A socket push or an FCM
 * send goes here later, before markSent; if it throws, BullMQ retries the
 * job and only rows that aren't SENT yet go out again.
 */
async function deliver(
  notification: Notification,
  services: JobServices,
): Promise<void> {
  await services.notificationsService.markSent(notification.id);
}

/**
 * Creates the notification unless its dedupe key exists, then delivers it if
 * it hasn't gone out yet. A retry gets back the rows an earlier attempt
 * created, so only the ones that never went out are delivered again.
 * Returns whether it delivered this time.
 */
export async function notifyOnce(
  services: JobServices,
  input: CreateNotificationInput,
): Promise<boolean> {
  const { notification } =
    await services.notificationsService.createOnce(input);
  if (
    notification.status !== NotificationStatus.PENDING &&
    notification.status !== NotificationStatus.FAILED
  ) {
    return false;
  }
  await deliver(notification, services);
  return true;
}
