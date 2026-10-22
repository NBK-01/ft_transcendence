import { useCallback, useSyncExternalStore } from "react";
import type { Socket } from "socket.io-client";

import { ensureAccessToken, renewAccessToken, socketPath } from "./client";
import { tokens } from "./session";
import type { ChatMessage, PresenceEvent, SupportMessageEvent } from "./types";

/** What the backend's ChatGateway sends. `exception` is a refused action (ApiErrorBody-like, e.g. 11003). */
export type ChatEvents = {
  connect: () => void;
  disconnect: () => void;
  "message.new": (message: ChatMessage) => void;
  "support.message.new": (event: SupportMessageEvent) => void;
  "presence.changed": (event: PresenceEvent) => void;
  exception: (error: { statusCode?: number; errorCode?: number; messages?: string[] }) => void;
};

/**
 * One chat connection. The real one is Socket.IO (ChatGateway); mock mode
 * swaps in an in-memory one (see `setChatConnectionFactory`).
 *
 * Sending goes over the socket, not POST /chat/conversations/:id/messages: only
 * the socket tells the other people in the conversation. There's no
 * acknowledgement: your message comes back as `message.new` (you're in the
 * room), or a refusal comes as `exception`.
 */
export type ChatConnection = {
  on<E extends keyof ChatEvents>(event: E, listener: ChatEvents[E]): () => void;
  /** Receive a conversation's `message.new`. Rejoined after every reconnect. */
  join(conversationId: string): void;
  leave(conversationId: string): void;
  send(conversationId: string, content: string): void;
  connect(): void;
  close(): void;
  /** Whether it's connected right now (see useChatConnected to follow it). */
  readonly connected: boolean;
};

type Factory = () => ChatConnection;
type SocketListener = Parameters<Socket["on"]>[1];

/**
 * The real connection. socket.io-client is loaded on first use (not at app
 * start), so pages without chat don't download it; until it's there, listeners
 * and sends wait for it.
 */
function createSocketConnection(): ChatConnection {
  const joined = new Set<string>();
  const listeners: [string, SocketListener][] = [];
  let socket: Socket | null = null;
  let closed = false;
  let renewing = false;

  const ready = import("socket.io-client").then(({ io }) => {
    if (closed) return null;
    socket = io({
      path: socketPath(),
      autoConnect: false,
      // Read on every (re)connect, so a renewed token is used.
      auth: (send) => send({ token: tokens.getAccess() ?? "" }),
    });
    socket.on("connect", () => {
      renewing = false;
      for (const id of joined) socket?.emit("joinConversation", { conversationId: id });
    });
    // The handshake refuses a missing or expired token with "Unauthorized", and
    // doesn't retry by itself: renew the token once, then try again.
    socket.on("connect_error", (error) => {
      if (error.message !== "Unauthorized" || renewing) return;
      renewing = true;
      void renewAccessToken().then((renewed) => renewed && socket?.connect());
    });
    for (const [event, listener] of listeners) socket.on(event, listener);
    return socket;
  });

  return {
    on(event, listener) {
      const entry: [string, SocketListener] = [event, listener as SocketListener];
      listeners.push(entry);
      socket?.on(...entry);
      return () => {
        listeners.splice(listeners.indexOf(entry), 1);
        socket?.off(...entry);
      };
    },
    join(id) {
      joined.add(id);
      if (socket?.connected) socket.emit("joinConversation", { conversationId: id });
    },
    leave(id) {
      joined.delete(id);
      if (socket?.connected) socket.emit("leaveConversation", { conversationId: id });
    },
    send(conversationId, content) {
      // Socket.IO holds emits made while it's reconnecting and sends them once connected.
      void ready.then((live) => live?.emit("sendMessage", { conversationId, content }));
    },
    connect() {
      void Promise.all([ready, ensureAccessToken()]).then(([live, hasToken]) => hasToken && live?.connect());
    },
    close() {
      closed = true;
      joined.clear();
      socket?.disconnect();
    },
    get connected() {
      return socket?.connected ?? false;
    },
  };
}

let factory: Factory = createSocketConnection;

/** Mock mode (startMocks) swaps in the in-memory connection. Call before anything connects. */
export function setChatConnectionFactory(next: Factory) {
  factory = next;
}

/*
 * One connection per tab, shared by every component that uses chat. It opens
 * with the first subscriber and closes a moment after the last one leaves (so
 * a remount or a quick page change doesn't reconnect), or right away on sign-out.
 */
let shared: { connection: ChatConnection; users: number; closing?: ReturnType<typeof setTimeout> } | null = null;
const subscribers = new Set<() => void>();

function close() {
  shared?.connection.close();
  shared = null;
  for (const subscriber of subscribers) subscriber();
}

let watchingSession = false;

function subscribe(subscriber: () => void) {
  // Started here rather than at import, so loading this module has no side effects.
  if (!watchingSession) {
    watchingSession = true;
    tokens.subscribe(() => {
      if (!tokens.hasSession()) close();
    });
  }
  subscribers.add(subscriber);
  if (!shared) {
    shared = { connection: factory(), users: 0 };
    shared.connection.connect();
  }
  clearTimeout(shared.closing);
  shared.users += 1;
  const mine = shared;
  return () => {
    subscribers.delete(subscriber);
    if (shared !== mine) return;
    mine.users -= 1;
    if (mine.users === 0) mine.closing = setTimeout(close, 2000);
  };
}

const getConnection = () => shared?.connection ?? null;

/**
 * The tab's chat connection, open while at least one mounted component uses
 * it; null before the first render subscribes and after sign-out. Listen with
 * `connection.on(...)` in an effect, and return its unsubscribe.
 */
export function useChatConnection(): ChatConnection | null {
  return useSyncExternalStore(subscribe, getConnection, () => null);
}

/** Whether `connection` is up, re-rendering when it connects or drops (e.g. to show "Offline"). */
export function useChatConnected(connection: ChatConnection | null) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!connection) return () => {};
      const offConnect = connection.on("connect", onChange);
      const offDisconnect = connection.on("disconnect", onChange);
      return () => {
        offConnect();
        offDisconnect();
      };
    },
    [connection],
  );
  return useSyncExternalStore(subscribe, () => connection?.connected ?? false, () => false);
}
