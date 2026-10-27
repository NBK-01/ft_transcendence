import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { personalRoom } from '../chat/chat.constants';
import { websocketConfig } from '../config/websocket.config';
import { Notification } from './entities/notification.entity';
import { NotificationFactory } from './factories/notification.factory';

/** The socket event a new notification arrives as, with its NotificationDto. */
export const NOTIFICATION_NEW_EVENT = 'notification.new';

/**
 * Pushes a notification to its recipient's open tabs. Emit-only: it shares
 * ChatGateway's Socket.IO server (Nest gives gateways on the same port and
 * path one server, and its Redis adapter reaches every instance), so the
 * handshake auth and the personal room every connection joins are
 * ChatGateway's.
 */
@WebSocketGateway({
  cors: { origin: websocketConfig().corsOrigins, credentials: true },
})
export class NotificationsGateway {
  @WebSocketServer()
  private readonly server?: Server;

  push(notification: Notification): void {
    this.server
      ?.to(
        personalRoom({
          accountType: notification.accountType,
          id: notification.userId,
        }),
      )
      .emit(NOTIFICATION_NEW_EVENT, NotificationFactory.toDto(notification));
  }
}
