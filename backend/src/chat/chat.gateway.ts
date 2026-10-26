import { UseFilters } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConnectionAuthenticator } from './connection-authenticator';
import { PresenceService } from './presence.service';
import { ChatService } from './chat.service';
import { ConversationType } from './entities/conversation.entity';
import { AccessControlService } from '../access-control/access-control.service';
import { InternalUsersService } from '../internal-users/internal-users.service';
import { AccountType, RequestUser } from '../common/context/auth-context.types';
import { CHAT_SUPPORT_ACCESS_PERMISSION } from './chat.constants';
import { websocketConfig } from '../config/websocket.config';
import { WsExceptionFilter } from './ws-exception.filter';

const SUPPORT_POOL_ROOM = 'staff:support-pool';
const REVALIDATION_INTERVAL_MS = 5 * 60 * 1000;

interface SocketData {
  user: RequestUser;
  organizationId: string | null;
  revalidationInterval: ReturnType<typeof setInterval>;
}

@WebSocketGateway({
  cors: { origin: websocketConfig().corsOrigins, credentials: true },
})
@UseFilters(WsExceptionFilter)
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly connectionAuthenticator: ConnectionAuthenticator,
    private readonly presenceService: PresenceService,
    private readonly chatService: ChatService,
    private readonly accessControlService: AccessControlService,
    private readonly internalUsersService: InternalUsersService,
  ) {}

  /**
   * Authenticates during the Socket.IO handshake itself (middleware), not in
   * handleConnection — a handshake-time check blocks the client's 'connect'
   * event until it resolves. Authenticating inside handleConnection instead
   * (an async, non-blocking hook) raced a client that emits an event the
   * instant it sees 'connect': the event could reach handleJoinConversation/
   * handleSendMessage before handleConnection's awaited DB lookup finished
   * and set client.data, throwing "Socket reached a message handler without
   * an authenticated user" for a perfectly normal connect-then-act client.
   */
  afterInit(server: Server): void {
    server.use((socket, next) => {
      this.connectionAuthenticator
        .authenticate(socket)
        .then((user) => {
          socket.data = { user } as Partial<SocketData>;
          next();
        })
        .catch(() => next(new Error('Unauthorized')));
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    // Auth already happened in the handshake middleware (see afterInit) — a
    // socket that reaches here always has client.data.user set; the ?. is
    // defensive only, there's no legitimate path where it's missing.
    const user = this.dataOf(client)?.user;
    if (!user) {
      client.disconnect();
      return;
    }
    const organizationId = await this.joinStaffRooms(client, user);
    this.storeOnSocket(client, user, organizationId);
    await client.join(this.personalRoom(user));
    await this.presenceService.markOnline(user.accountType, user.id, client.id);
    this.broadcastPresenceChanged(user, organizationId, true);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const data = this.dataOf(client);
    clearInterval(data?.revalidationInterval);
    if (!data?.user) {
      return;
    }
    const wentFullyOffline = await this.presenceService.markOffline(
      data.user.accountType,
      data.user.id,
      client.id,
    );
    if (wentFullyOffline) {
      this.broadcastPresenceChanged(data.user, data.organizationId, false);
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ): Promise<void> {
    const user = this.requireUser(client);
    await this.presenceService.refreshPresence(user.accountType, user.id);
    await this.chatService.getAuthorizedConversation(user, body.conversationId);
    await client.join(this.conversationRoom(body.conversationId));
  }

  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ): Promise<void> {
    await client.leave(this.conversationRoom(body.conversationId));
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; content: string },
  ): Promise<void> {
    const user = this.requireUser(client);
    await this.presenceService.refreshPresence(user.accountType, user.id);
    const { message, conversationType } =
      await this.chatService.sendMessageWithType(
        user,
        body.conversationId,
        body.content,
      );
    this.server
      .to(this.conversationRoom(body.conversationId))
      .emit('message.new', message);
    // A staff DM's preview is for its two participants, not the whole pool.
    if (conversationType === ConversationType.SUPPORT) {
      this.server.to(SUPPORT_POOL_ROOM).emit('support.message.new', {
        conversationId: body.conversationId,
        preview: body.content.slice(0, 80),
      });
    }
  }

  private storeOnSocket(
    client: Socket,
    user: RequestUser,
    organizationId: string | null,
  ): void {
    const data: SocketData = {
      user,
      organizationId,
      revalidationInterval: setInterval(
        () => this.revalidate(client, user),
        REVALIDATION_INTERVAL_MS,
      ),
    };
    client.data = data;
  }

  private dataOf(client: Socket): SocketData | undefined {
    return client.data as SocketData | undefined;
  }

  private requireUser(client: Socket): RequestUser {
    const data = this.dataOf(client);
    if (!data?.user) {
      throw new Error(
        'Socket reached a message handler without an authenticated user',
      );
    }
    return data.user;
  }

  private async revalidate(client: Socket, user: RequestUser): Promise<void> {
    const stillValid = await this.connectionAuthenticator.isStillValid(user);
    if (!stillValid) {
      client.disconnect();
    }
  }

  /** Joins the support-pool room (if permitted) and the org room (if assigned to one) — returns the organizationId so handleDisconnect can broadcast to the same room later. */
  private async joinStaffRooms(
    client: Socket,
    user: RequestUser,
  ): Promise<string | null> {
    if (user.accountType !== AccountType.STAFF) {
      return null;
    }
    const [staff, hasSupportAccess] = await Promise.all([
      this.internalUsersService.findById(user.id),
      this.accessControlService.hasPermission(
        user.id,
        CHAT_SUPPORT_ACCESS_PERMISSION,
      ),
    ]);
    if (hasSupportAccess) {
      await client.join(SUPPORT_POOL_ROOM);
    }
    if (staff?.organizationId) {
      await client.join(this.organizationRoom(staff.organizationId));
    }
    return staff?.organizationId ?? null;
  }

  /**
   * Targets both rooms in a single emit (array form) rather than two separate
   * .emit() calls — a staff member is a member of both their own personal
   * room and their org room, and two separate emits each deliver once,
   * duplicating the event for that one socket. Socket.IO's array form
   * dedupes by socket id before sending, so each recipient gets exactly one.
   */
  private broadcastPresenceChanged(
    user: RequestUser,
    organizationId: string | null,
    online: boolean,
  ): void {
    const payload = {
      accountId: user.id,
      accountType: user.accountType,
      online,
    };
    const rooms = [this.personalRoom(user)];
    if (organizationId) {
      rooms.push(this.organizationRoom(organizationId));
    }
    this.server.to(rooms).emit('presence.changed', payload);
  }

  private personalRoom(user: RequestUser): string {
    return `user:${user.accountType}:${user.id}`;
  }

  private organizationRoom(organizationId: string): string {
    return `org:${organizationId}`;
  }

  private conversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }
}
