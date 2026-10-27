import { Notification } from '../entities/notification.entity';
import { NotificationDto } from '../dto/notification.dto';

export class NotificationFactory {
  static toDto(notification: Notification): NotificationDto {
    return {
      id: notification.id,
      type: notification.type,
      status: notification.status,
      title: notification.title,
      message: notification.message,
      payload: notification.payload,
      ownAction: notification.ownAction,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    };
  }

  static toDtoArray(notifications: Notification[]): NotificationDto[] {
    return notifications.map((notification) => this.toDto(notification));
  }
}
