import { ArgumentsHost } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { AccessControlService } from '../access-control/access-control.service';
import { Role } from '../access-control/entities/role.entity';
import { AccountType, RequestUser } from '../common/context/auth-context.types';
import { CryptoService } from '../common/services/crypto.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { InternalUser } from '../internal-users/internal-user.entity';
import { InternalUsersService } from '../internal-users/internal-users.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { jwtConfig } from '../config/jwt.config';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ConnectionAuthenticator } from './connection-authenticator';
import { ConversationType } from './entities/conversation.entity';
import { PRESENCE_HEARTBEAT_MS, PresenceService } from './presence.service';
import { ContactsService } from '../contacts/contacts.service';
import { WsExceptionFilter } from './ws-exception.filter';
import {
  ChatErrorCodes,
  ChatErrorMessages,
  ConversationNotFoundException,
} from './exceptions';
import { TokenType } from '../auth/interfaces/jwt-payload.interface';

/**
 * ChatGateway over a real ConnectionAuthenticator + real JwtService (actual
 * signing/verification, not a stubbed "trust me it's valid user-1"), real
 * UsersService/InternalUsersService backed by in-memory tables, and a bare
 * ChatService stub since its own authorization logic is covered by
 * chat-access.service.spec.ts — this file only checks that the gateway
 * calls it correctly and reacts correctly to what it throws.
 *
 * Socket.IO's Server/Socket are hand-rolled fakes (join/emit/to/handshake)
 * since there's no way around that at the gateway layer, but every
 * assertion below is on real behaviour: which room string was joined, what
 * event/payload was emitted, not just "a function was called".
 */

const JWT_SECRET = jwtConfig().secret;

// handleConnection schedules a real 5-minute revalidation interval
// (ChatGateway.storeOnSocket) that nothing in a unit test ever clears —
// without this, every handleConnection test leaks a live timer and the
// Jest process hangs past the test run waiting for it. Nothing here
// exercises the revalidation tick itself, so a harmless fixed handle is
// enough; clearInterval still receives whatever handle was returned,
// which is what the "clears the periodic revalidation interval" test checks.
let setIntervalSpy: jest.SpiedFunction<typeof setInterval>;
beforeAll(() => {
  setIntervalSpy = jest
    .spyOn(global, 'setInterval')
    .mockImplementation(() => 1 as unknown as NodeJS.Timeout);
});
afterAll(() => {
  setIntervalSpy.mockRestore();
});

function setup() {
  const users: User[] = [];
  const internalUsers: InternalUser[] = [];

  const usersRepository = {
    findOne: ({ where }: { where: { id: string } }) =>
      Promise.resolve(users.find((u) => u.id === where.id) ?? null),
  };
  const internalUsersRepository = {
    findOne: ({ where }: { where: { id: string } }) =>
      Promise.resolve(internalUsers.find((u) => u.id === where.id) ?? null),
  };

  const usersService = new UsersService(
    usersRepository as unknown as Repository<User>,
    {} as CryptoService,
    {} as FileStorageService,
    new EventEmitter2(),
  );
  const internalUsersService = new InternalUsersService(
    internalUsersRepository as unknown as Repository<InternalUser>,
    {} as Repository<Role>,
    {} as CryptoService,
    new EventEmitter2(),
  );
  const jwtService = new JwtService({ secret: JWT_SECRET });
  const connectionAuthenticator = new ConnectionAuthenticator(
    jwtService,
    usersService,
    internalUsersService,
  );

  const presenceService = {
    markOnline: jest.fn().mockResolvedValue(undefined),
    markOffline: jest.fn().mockResolvedValue(true),
    refreshPresence: jest.fn().mockResolvedValue(undefined),
  } as unknown as PresenceService;

  const chatService = {
    getAuthorizedConversation: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    sendMessageWithType: jest.fn().mockResolvedValue({
      message: { id: 'message-1', conversationId: 'conv-1', content: 'hi' },
      conversationType: ConversationType.SUPPORT,
    }),
  } as unknown as ChatService;

  const supportStaff = new Set<string>();
  const accessControlService = {
    hasPermission: jest.fn((userId: string) =>
      Promise.resolve(supportStaff.has(userId)),
    ),
  } as unknown as AccessControlService;

  /** Each staff member's accepted contacts: who hears about their presence. */
  const contactIds = new Map<string, string[]>();
  const contactsService = {
    listAcceptedContactIds: jest.fn((id: string) =>
      Promise.resolve(contactIds.get(id) ?? []),
    ),
  } as unknown as ContactsService;

  const gateway = new ChatGateway(
    connectionAuthenticator,
    presenceService,
    chatService,
    accessControlService,
    internalUsersService,
    contactsService,
  );

  const addCustomer = (id: string) => {
    users.push(Object.assign(new User(), { id, email: `${id}@example.com` }));
  };
  const addStaff = (
    id: string,
    options: {
      organizationId?: string | null;
      isActive?: boolean;
      supportAccess?: boolean;
    } = {},
  ) => {
    const {
      organizationId = null,
      isActive = true,
      supportAccess = false,
    } = options;
    internalUsers.push(
      Object.assign(new InternalUser(), {
        id,
        email: `${id}@example.com`,
        isActive,
        organizationId,
      }),
    );
    if (supportAccess) supportStaff.add(id);
  };

  const signAccessToken = (
    sub: string,
    accountType: AccountType,
    options: { expiresIn?: number | string } = {},
  ) =>
    jwtService.sign(
      { sub, type: TokenType.ACCESS, accountType },
      { expiresIn: options.expiresIn ?? '15m' },
    );

  return {
    gateway,
    connectionAuthenticator,
    contactIds,
    presenceService,
    chatService,
    accessControlService,
    addCustomer,
    addStaff,
    signAccessToken,
    jwtService,
  };
}

const customerUser = (id: string): RequestUser => ({
  id,
  email: `${id}@example.com`,
  accountType: AccountType.CUSTOMER,
});
const staffUser = (id: string): RequestUser => ({
  id,
  email: `${id}@example.com`,
  accountType: AccountType.STAFF,
});

function fakeServer() {
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  const use = jest.fn();
  return { server: { to, use } as unknown as Server, to, emit, use };
}

function fakeSocket(overrides: Partial<Record<string, unknown>> = {}): Socket {
  return {
    id: 'socket-1',
    handshake: { auth: {} },
    data: {},
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
    ...overrides,
  } as unknown as Socket;
}

/** A socket that already completed the handshake, as handleConnection expects. */
const connectedSocket = (
  user: RequestUser,
  data: Record<string, unknown> = {},
): Socket => fakeSocket({ data: { user, ...data } });

/** Installs a fake Server on an already-constructed gateway and returns its to()/emit() spies. */
function wireServer(gateway: ChatGateway) {
  const { server, to, emit } = fakeServer();
  (gateway as unknown as { server: Server }).server = server;
  return { to, emit };
}

/** Runs the real afterInit() middleware against one socket, resolving with whatever error (if any) was passed to next(). */
function runHandshake(
  gateway: ChatGateway,
  socket: Socket,
): Promise<Error | undefined> {
  let middleware!: (socket: Socket, next: (err?: Error) => void) => void;
  const server = { use: (fn: typeof middleware) => (middleware = fn) };
  gateway.afterInit(server as unknown as Server);
  return new Promise((resolve) => middleware(socket, resolve));
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (reason: unknown) => reason,
  );
}

describe('handshake authentication: accepted', () => {
  it('a valid customer access token is accepted and the resolved user is attached', async () => {
    const { gateway, addCustomer, signAccessToken } = setup();
    addCustomer('cust-1');
    const socket = fakeSocket({
      handshake: {
        auth: { token: signAccessToken('cust-1', AccountType.CUSTOMER) },
      },
    });

    const error = await runHandshake(gateway, socket);

    expect(error).toBeUndefined();
    expect((socket.data as { user: RequestUser }).user).toEqual(
      customerUser('cust-1'),
    );
  });

  it('a valid, active staff access token is accepted', async () => {
    const { gateway, addStaff, signAccessToken } = setup();
    addStaff('staff-1');
    const socket = fakeSocket({
      handshake: {
        auth: { token: signAccessToken('staff-1', AccountType.STAFF) },
      },
    });

    const error = await runHandshake(gateway, socket);

    expect(error).toBeUndefined();
    expect((socket.data as { user: RequestUser }).user).toEqual(
      staffUser('staff-1'),
    );
  });
});

describe('handshake authentication: rejected', () => {
  it('no token at all', async () => {
    const { gateway } = setup();
    const socket = fakeSocket();

    const error = await runHandshake(gateway, socket);

    expect(error).toBeInstanceOf(Error);
    expect(socket.data).toEqual({});
  });

  it.each([
    [
      'an expired access token',
      (ctx: ReturnType<typeof setup>) =>
        ctx.signAccessToken('cust-1', AccountType.CUSTOMER, { expiresIn: -10 }),
    ],
    [
      'a token with a tampered signature',
      (ctx: ReturnType<typeof setup>) =>
        `${ctx.signAccessToken('cust-1', AccountType.CUSTOMER)}tampered`,
    ],
    [
      'a refresh token presented at the socket layer',
      (ctx: ReturnType<typeof setup>) =>
        ctx.jwtService.sign(
          {
            sub: 'cust-1',
            type: TokenType.REFRESH,
            accountType: AccountType.CUSTOMER,
            jti: 'refresh-1',
          },
          { expiresIn: '30d' },
        ),
    ],
  ])('%s', async (_label, buildToken) => {
    const ctx = setup();
    ctx.addCustomer('cust-1');
    const socket = fakeSocket({
      handshake: { auth: { token: buildToken(ctx) } },
    });

    const error = await runHandshake(ctx.gateway, socket);

    expect(error).toBeInstanceOf(Error);
  });

  it('a deactivated staff account, mirroring the REST login isActive check', async () => {
    const { gateway, addStaff, signAccessToken } = setup();
    addStaff('staff-1', { isActive: false });
    const socket = fakeSocket({
      handshake: {
        auth: { token: signAccessToken('staff-1', AccountType.STAFF) },
      },
    });

    const error = await runHandshake(gateway, socket);

    expect(error).toBeInstanceOf(Error);
  });

  it.each([
    ['a staff id that no longer exists', 'ghost-staff', AccountType.STAFF],
    ['a customer id that no longer exists', 'ghost-cust', AccountType.CUSTOMER],
  ])('a token for %s', async (_label, id, accountType) => {
    const { gateway, signAccessToken } = setup();
    const socket = fakeSocket({
      handshake: { auth: { token: signAccessToken(id, accountType) } },
    });

    const error = await runHandshake(gateway, socket);

    expect(error).toBeInstanceOf(Error);
  });
});

describe('handleConnection: room joins', () => {
  it('a customer joins only their own personal room, and presence is broadcast to just that room', async () => {
    const { gateway, addCustomer } = setup();
    addCustomer('cust-1');
    const { to, emit } = wireServer(gateway);
    const socket = connectedSocket(customerUser('cust-1'));

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledTimes(1);
    expect(socket.join).toHaveBeenCalledWith('user:customer:cust-1');
    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith(['user:customer:cust-1']);
    expect(emit).toHaveBeenCalledWith('presence.changed', {
      accountId: 'cust-1',
      accountType: AccountType.CUSTOMER,
      online: true,
    });
  });

  it('staff with no organization and no support access join only their personal room', async () => {
    const { gateway, addStaff } = setup();
    addStaff('staff-1');
    const { to } = wireServer(gateway);
    const socket = connectedSocket(staffUser('staff-1'));

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledTimes(1);
    expect(socket.join).toHaveBeenCalledWith('user:staff:staff-1');
    expect(to).toHaveBeenCalledWith(['user:staff:staff-1']);
  });

  it("staff in an organization also join its room; presence goes to their own room and their accepted contacts', not the branch's", async () => {
    const { gateway, addStaff, contactIds } = setup();
    addStaff('staff-1', { organizationId: 'org-1' });
    contactIds.set('staff-1', ['staff-2', 'staff-3']);
    const { to } = wireServer(gateway);
    const socket = connectedSocket(staffUser('staff-1'));

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledTimes(2);
    expect(socket.join).toHaveBeenCalledWith('org:org-1');
    expect(socket.join).toHaveBeenCalledWith('user:staff:staff-1');
    expect(to).toHaveBeenCalledWith([
      'user:staff:staff-1',
      'user:staff:staff-2',
      'user:staff:staff-3',
    ]);
  });

  it('keeps presence alive while connected (a heartbeat), and stops on disconnect', async () => {
    jest.useFakeTimers();
    try {
      const { gateway, addStaff, presenceService } = setup();
      addStaff('staff-1');
      wireServer(gateway);
      const socket = connectedSocket(staffUser('staff-1'));
      await gateway.handleConnection(socket);
      const refresh = presenceService.refreshPresence as jest.Mock;

      jest.advanceTimersByTime(PRESENCE_HEARTBEAT_MS * 2);
      expect(refresh).toHaveBeenCalledTimes(2);
      expect(refresh).toHaveBeenCalledWith(AccountType.STAFF, 'staff-1');

      await gateway.handleDisconnect(socket);
      jest.advanceTimersByTime(PRESENCE_HEARTBEAT_MS * 2);
      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('staff with support-pool access additionally join the support pool room, which is not part of the presence broadcast', async () => {
    const { gateway, addStaff } = setup();
    addStaff('staff-1', { supportAccess: true });
    const { to } = wireServer(gateway);
    const socket = connectedSocket(staffUser('staff-1'));

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledWith('staff:support-pool');
    expect(socket.join).toHaveBeenCalledTimes(2);
    expect(to).toHaveBeenCalledWith(['user:staff:staff-1']);
  });

  it('a customer never joins an org or support-pool room', async () => {
    const { gateway, addCustomer } = setup();
    addCustomer('cust-1');
    wireServer(gateway);
    const socket = connectedSocket(customerUser('cust-1'));

    await gateway.handleConnection(socket);

    expect(socket.join).not.toHaveBeenCalledWith('staff:support-pool');
    expect(socket.join).not.toHaveBeenCalledWith(
      expect.stringMatching(/^org:/),
    );
  });

  it('disconnects the socket and does nothing else if somehow no user was attached', async () => {
    const { gateway, presenceService } = setup();
    wireServer(gateway);
    const socket = fakeSocket();

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.join).not.toHaveBeenCalled();
    expect(presenceService.markOnline).not.toHaveBeenCalled();
  });
});

describe('handleJoinConversation', () => {
  it('refreshes presence, authorizes through ChatService, then joins the conversation room', async () => {
    const { gateway, chatService, presenceService } = setup();
    const user = staffUser('staff-1');
    const socket = fakeSocket({ data: { user } });

    await gateway.handleJoinConversation(socket, { conversationId: 'conv-1' });

    expect(presenceService.refreshPresence).toHaveBeenCalledWith(
      AccountType.STAFF,
      'staff-1',
    );
    expect(chatService.getAuthorizedConversation).toHaveBeenCalledWith(
      user,
      'conv-1',
    );
    expect(socket.join).toHaveBeenCalledWith('conversation:conv-1');
  });

  it('propagates a DomainException from ChatService instead of joining the room', async () => {
    const { gateway, chatService } = setup();
    (chatService.getAuthorizedConversation as jest.Mock).mockRejectedValue(
      new ConversationNotFoundException('conv-404'),
    );
    const socket = fakeSocket({ data: { user: staffUser('staff-1') } });

    const error = await rejection(
      gateway.handleJoinConversation(socket, { conversationId: 'conv-404' }),
    );

    expect(error).toBeInstanceOf(ConversationNotFoundException);
    expect(socket.join).not.toHaveBeenCalled();
  });
});

describe('handleSendMessage', () => {
  it('refreshes presence, sends through ChatService, then broadcasts a support message to the conversation room and the support pool', async () => {
    const { gateway, chatService, presenceService } = setup();
    const { to, emit } = wireServer(gateway);
    const user = staffUser('staff-1');
    const socket = fakeSocket({ data: { user } });

    await gateway.handleSendMessage(socket, {
      conversationId: 'conv-1',
      content: 'hello there',
    });

    expect(presenceService.refreshPresence).toHaveBeenCalledWith(
      AccountType.STAFF,
      'staff-1',
    );
    expect(chatService.sendMessageWithType).toHaveBeenCalledWith(
      user,
      'conv-1',
      'hello there',
    );
    expect(to).toHaveBeenCalledWith('conversation:conv-1');
    expect(to).toHaveBeenCalledWith('staff:support-pool');
    expect(emit).toHaveBeenCalledWith(
      'message.new',
      expect.objectContaining({ id: 'message-1' }),
    );
    expect(emit).toHaveBeenCalledWith('support.message.new', {
      conversationId: 'conv-1',
      preview: 'hello there',
    });
  });

  it('truncates the support-pool preview to 80 characters', async () => {
    const { gateway } = setup();
    const { emit } = wireServer(gateway);
    const longContent = 'x'.repeat(120);
    const socket = fakeSocket({ data: { user: staffUser('staff-1') } });

    await gateway.handleSendMessage(socket, {
      conversationId: 'conv-1',
      content: longContent,
    });

    expect(emit).toHaveBeenCalledWith('support.message.new', {
      conversationId: 'conv-1',
      preview: 'x'.repeat(80),
    });
  });

  it('propagates a DomainException from ChatService and never broadcasts', async () => {
    const { gateway, chatService } = setup();
    (chatService.sendMessageWithType as jest.Mock).mockRejectedValue(
      new ConversationNotFoundException('conv-404'),
    );
    const { to } = wireServer(gateway);
    const socket = fakeSocket({ data: { user: staffUser('staff-1') } });

    const error = await rejection(
      gateway.handleSendMessage(socket, {
        conversationId: 'conv-404',
        content: 'hi',
      }),
    );

    expect(error).toBeInstanceOf(ConversationNotFoundException);
    expect(to).not.toHaveBeenCalled();
  });

  it.each(['handleJoinConversation', 'handleSendMessage'] as const)(
    '%s on a socket that never completed the handshake throws instead of silently acting',
    async (method) => {
      const { gateway } = setup();
      const socket = fakeSocket();

      await expect(
        (
          gateway[method] as (
            c: Socket,
            b: Record<string, string>,
          ) => Promise<void>
        )(socket, { conversationId: 'conv-1', content: 'hi' }),
      ).rejects.toThrow(
        'Socket reached a message handler without an authenticated user',
      );
    },
  );
});

// A staff DM's preview stays with its two participants.
describe('handleSendMessage in a staff DM', () => {
  it('sends a staff DM to its conversation room only, never to the support pool', async () => {
    const { gateway, chatService } = setup();
    (chatService.sendMessageWithType as jest.Mock).mockResolvedValue({
      message: { id: 'message-2', conversationId: 'dm-1', content: 'private' },
      conversationType: ConversationType.STAFF_DM,
    });
    const { to, emit } = wireServer(gateway);
    const socket = fakeSocket({ data: { user: staffUser('staff-1') } });

    await gateway.handleSendMessage(socket, {
      conversationId: 'dm-1',
      content: 'private',
    });

    expect(to).toHaveBeenCalledWith('conversation:dm-1');
    expect(to).not.toHaveBeenCalledWith('staff:support-pool');
    expect(emit).toHaveBeenCalledWith(
      'message.new',
      expect.objectContaining({ id: 'message-2' }),
    );
    expect(emit).not.toHaveBeenCalledWith(
      'support.message.new',
      expect.anything(),
    );
  });
});

describe('exception handling (WsExceptionFilter, bound on the gateway)', () => {
  function filterSetup() {
    const i18n = { translate: (key: string) => key };
    const filter = new WsExceptionFilter(i18n as never);
    const socket = fakeSocket();
    const host = {
      switchToWs: () => ({ getClient: () => socket }),
    } as unknown as ArgumentsHost;
    return { filter, socket, host };
  }

  it('a DomainException thrown by a handler is emitted as "exception" with its error code', () => {
    const { filter, socket, host } = filterSetup();

    filter.catch(new ConversationNotFoundException('conv-404'), host);

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('exception', {
      errorCode: ChatErrorCodes.ConversationNotFound,
      messages: [ChatErrorMessages.ConversationNotFound],
    });
  });

  it('a non-domain error is emitted as a generic exception with no error code', () => {
    const { filter, socket, host } = filterSetup();

    filter.catch(
      new Error(
        'Socket reached a message handler without an authenticated user',
      ),
      host,
    );

    expect(socket.emit).toHaveBeenCalledWith('exception', {
      messages: ['errors.UNKNOWN_ERROR'],
    });
  });
});

describe('handleDisconnect', () => {
  it('fully offline (last device): broadcasts presence to all rooms in a single to()/emit() call, not one per room (regression: this used to double-emit)', async () => {
    const { gateway, presenceService, contactIds } = setup();
    (presenceService.markOffline as jest.Mock).mockResolvedValue(true);
    contactIds.set('staff-1', ['staff-2']);
    const { to, emit } = wireServer(gateway);
    const socket = connectedSocket(staffUser('staff-1'), {
      organizationId: 'org-1',
      revalidationInterval: setInterval(() => undefined, 1000),
    });

    await gateway.handleDisconnect(socket);

    expect(presenceService.markOffline).toHaveBeenCalledWith(
      AccountType.STAFF,
      'staff-1',
      'socket-1',
    );
    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith([
      'user:staff:staff-1',
      'user:staff:staff-2',
    ]);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('presence.changed', {
      accountId: 'staff-1',
      accountType: AccountType.STAFF,
      online: false,
    });
  });

  it('still has another connected device: no presence broadcast at all', async () => {
    const { gateway, presenceService } = setup();
    (presenceService.markOffline as jest.Mock).mockResolvedValue(false);
    const { to } = wireServer(gateway);
    const socket = connectedSocket(staffUser('staff-1'), {
      organizationId: null,
      revalidationInterval: setInterval(() => undefined, 1000),
    });

    await gateway.handleDisconnect(socket);

    expect(to).not.toHaveBeenCalled();
  });

  it('clears the periodic revalidation interval', async () => {
    const { gateway, presenceService } = setup();
    (presenceService.markOffline as jest.Mock).mockResolvedValue(false);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    wireServer(gateway);
    const interval = setInterval(() => undefined, 1000);
    const socket = connectedSocket(staffUser('staff-1'), {
      organizationId: null,
      revalidationInterval: interval,
    });

    await gateway.handleDisconnect(socket);

    expect(clearIntervalSpy).toHaveBeenCalledWith(interval);
    clearIntervalSpy.mockRestore();
  });

  it('a socket that never finished the handshake disconnects cleanly with no presence call', async () => {
    const { gateway, presenceService } = setup();
    const { to } = wireServer(gateway);
    const socket = fakeSocket();

    await gateway.handleDisconnect(socket);

    expect(presenceService.markOffline).not.toHaveBeenCalled();
    expect(to).not.toHaveBeenCalled();
  });
});

describe('current gaps (pinned, not endorsed)', () => {
  it('presence is broadcast to the personal room and accepted contacts, but never to the support-pool room, so support staff watching the pool never see a colleague go offline from there', async () => {
    const { gateway, addStaff } = setup();
    addStaff('staff-1', { supportAccess: true });
    const { to } = wireServer(gateway);
    const socket = connectedSocket(staffUser('staff-1'));

    await gateway.handleConnection(socket);

    expect(to).not.toHaveBeenCalledWith(
      expect.arrayContaining(['staff:support-pool']),
    );
  });

  it('handleLeaveConversation never verifies the caller ever joined (or was ever authorized into) that conversation — any authenticated socket can leave any room name it guesses', async () => {
    const { gateway } = setup();
    const socket = fakeSocket({ data: { user: staffUser('staff-1') } });

    await gateway.handleLeaveConversation(socket, {
      conversationId: 'conv-never-joined',
    });

    expect(socket.leave).toHaveBeenCalledWith('conversation:conv-never-joined');
  });
});
