import { NotificationStatus } from '../../notifications/constants/notification.constants';
import { Notification } from '../../notifications/entities/notification.entity';
import { CreateNotificationInput } from '../../notifications/notifications.service';
import { JobServices } from '../interfaces/job-handler.interface';

/**
 * The row in the recipient's feed is the notification; delivering it marks
 * it SENT and pushes it to their open tabs (notification.new), which shows
 * it at once. A tab that's closed finds it in the feed. A push that can fail
 * (e.g. FCM) would go before markSent, so a failure leaves the row for
 * BullMQ's retry.
 */
async function deliver(
  notification: Notification,
  services: JobServices,
): Promise<void> {
  await services.notificationsService.markSent(notification.id);
  services.notificationsGateway.push({
    ...notification,
    status: NotificationStatus.SENT,
  });
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
