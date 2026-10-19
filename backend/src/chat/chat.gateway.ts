import { UseFilters } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConnectionAuthenticator } from './connection-authenticator';
import { PresenceService } from './presence.service';
import { ChatService } from './chat.service';
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
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly connectionAuthenticator: ConnectionAuthenticator,
    private readonly presenceService: PresenceService,
    private readonly chatService: ChatService,
    private readonly accessControlService: AccessControlService,
    private readonly internalUsersService: InternalUsersService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    let user: RequestUser;
    try {
      user = await this.connectionAuthenticator.authenticate(client);
    } catch {
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
    const message = await this.chatService.sendMessage(
      user,
      body.conversationId,
      body.content,
    );
    this.server
      .to(this.conversationRoom(body.conversationId))
      .emit('message.new', message);
    this.server.to(SUPPORT_POOL_ROOM).emit('support.message.new', {
      conversationId: body.conversationId,
      preview: body.content.slice(0, 80),
    });
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
    this.server.to(this.personalRoom(user)).emit('presence.changed', payload);
    if (organizationId) {
      this.server
        .to(this.organizationRoom(organizationId))
        .emit('presence.changed', payload);
    }
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
