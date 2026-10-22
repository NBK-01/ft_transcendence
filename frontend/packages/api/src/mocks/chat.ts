import { http } from "msw/http";

import type { ChatConnection, ChatEvents } from "../chat-socket";
import { roleCan } from "../permissions";
import { tokens } from "../session";
import type { AccountType, ChatMessage, Conversation, MessageResponse } from "../types";
import { areConnected } from "./contacts";
import { internalUsers, MOCK_USER } from "./data";
import { error, ok, paginated } from "./respond";
import { staffForToken } from "./staff-auth";

/**
 * Chat (backend ChatController + ChatGateway), REST and the socket in one
 * place, sharing one store. Same rules as ChatAccessService: a staff DM is for
 * its two participants, and sending needs them to still be contacts; a support
 * conversation is for its customer and anyone with `chat:support:access`.
 *
 * The socket is an in-memory stand-in (`createMockChatConnection`, installed by
 * startMocks). Everything happens in this tab, so after you send, the other
 * side answers with a canned reply, to show messages arriving live.
 */

/** Backend ChatErrorCodes and AccessControlErrorCodes. */
const CONVERSATION_NOT_FOUND = 11001;
const NOT_CONVERSATION_PARTICIPANT = 11002;
const STAFF_NOT_CONNECTED = 11003;
const NOT_INTERNAL_USER = 7002;
const NOT_CUSTOMER = 7006;

const staffNamed = (name: string) => internalUsers.find((user) => user.name === name)!;
const nadia = staffNamed("Nadia Haddad");
const rami = staffNamed("Rami Khoury");
const salma = staffNamed("Salma Tazi");
const youssef = staffNamed("Youssef Benali");
const maya = staffNamed("Maya Azar");

const customer2 = "8f0c1d2e-0000-4000-8000-000000000002";

const minutes = (iso: string, plus: number) => new Date(Date.parse(iso) + plus * 60_000).toISOString();
let ids = 0;
const nextId = (prefix: string) => `00000000-0000-4000-${prefix}-${String(++ids).padStart(12, "0")}`;

const conversations: Conversation[] = [];
const messages: ChatMessage[] = [];

/** The backend sorts a DM's two staff ids, so a pair has one conversation. */
function addDm(a: string, b: string, start: string) {
  const [participantAId, participantBId] = a < b ? [a, b] : [b, a];
  const conversation: Conversation = { id: nextId("e000"), type: "staff_dm", participantAId, participantBId, createdAt: start, updatedAt: start };
  conversations.push(conversation);
  return conversation;
}

function addSupport(customerId: string, start: string) {
  const conversation: Conversation = { id: nextId("e000"), type: "support", customerId, createdAt: start, updatedAt: start };
  conversations.push(conversation);
  return conversation;
}

function addMessage(conversation: Conversation, senderId: string, senderType: AccountType, content: string, createdAt: string) {
  const message: ChatMessage = { id: nextId("f000"), conversationId: conversation.id, senderId, senderType, content, createdAt };
  messages.push(message);
  // Locally only: the backend doesn't move a conversation's updatedAt.
  conversation.updatedAt = createdAt;
  return message;
}

// Seed: Nadia (admin) has DMs and, with support access, the support inbox; Rami (dispatcher) has his DM with her.
{
  const withRami = addDm(nadia.id, rami.id, "2026-10-21T08:10:00.000Z");
  addMessage(withRami, rami.id, "staff", "Morning! The Beirut port pickup moved to 14:00.", "2026-10-21T08:10:00.000Z");
  addMessage(withRami, nadia.id, "staff", "Thanks, I'll tell the drivers.", "2026-10-21T08:12:00.000Z");
  addMessage(withRami, rami.id, "staff", "Karim can take it if Elie is busy.", "2026-10-21T08:15:00.000Z");

  const withSalma = addDm(nadia.id, salma.id, "2026-10-20T15:00:00.000Z");
  addMessage(withSalma, salma.id, "staff", "Customs released the Casablanca batch.", "2026-10-20T15:00:00.000Z");
  addMessage(withSalma, nadia.id, "staff", "Great news. Can you send me the list?", "2026-10-20T15:04:00.000Z");

  // Long enough to need "older messages" (more than one page of 50).
  const withYoussef = addDm(nadia.id, youssef.id, "2026-10-14T07:00:00.000Z");
  for (let n = 1; n <= 72; n += 1) {
    const from = n % 2 ? youssef.id : nadia.id;
    addMessage(withYoussef, from, "staff", `Shift handover note ${n}: all branches reported in.`, minutes("2026-10-14T07:00:00.000Z", n * 30));
  }

  const amina = addSupport(MOCK_USER.id, "2026-10-21T09:30:00.000Z");
  addMessage(amina, MOCK_USER.id, "customer", "Hi, my package ST-7K2Q-94A1 has said “out for delivery” since this morning.", "2026-10-21T09:30:00.000Z");
  addMessage(amina, maya.id, "staff", "Hi Amina, the driver is on the way. It should arrive before 18:00.", "2026-10-21T09:41:00.000Z");
  addMessage(amina, MOCK_USER.id, "customer", "Thank you!", "2026-10-21T09:42:00.000Z");

  const other = addSupport(customer2, "2026-10-21T11:05:00.000Z");
  addMessage(other, customer2, "customer", "Can I change the delivery address of my order?", "2026-10-21T11:05:00.000Z");
}

type Caller = { id: string; type: AccountType; supportAccess: boolean };

/** Who a mock access token belongs to: a staff member, or the mock customer (client app tokens). */
function callerFor(token: string | null | undefined): Caller | undefined {
  const staff = staffForToken(token);
  if (staff) return { id: staff.id, type: "staff", supportAccess: roleCan(staff.roleName, "chat:support:access") };
  if (token?.startsWith("mock-access-")) return { id: MOCK_USER.id, type: "customer", supportAccess: false };
  return undefined;
}

const bearer = (request: Request) => request.headers.get("Authorization")?.replace(/^Bearer /, "");

type Refusal = { statusCode: number; messages: string[]; errorCode?: number };

/** ChatAccessService.assertCanAccessConversation (and, for sending, the still-connected check). */
function check(caller: Caller, conversationId: string, sending = false): Refusal | { conversation: Conversation } {
  const conversation = conversations.find((candidate) => candidate.id === conversationId);
  if (!conversation) return { statusCode: 404, messages: [`Conversation ${conversationId} not found`], errorCode: CONVERSATION_NOT_FOUND };
  const allowed =
    conversation.type === "staff_dm"
      ? caller.id === conversation.participantAId || caller.id === conversation.participantBId
      : (caller.type === "customer" && caller.id === conversation.customerId) || caller.supportAccess;
  if (!allowed) {
    return { statusCode: 403, messages: ["You do not have access to this conversation"], errorCode: NOT_CONVERSATION_PARTICIPANT };
  }
  if (sending && conversation.type === "staff_dm" && !areConnected(conversation.participantAId!, conversation.participantBId!)) {
    return { statusCode: 403, messages: ["You must be connected contacts to message each other"], errorCode: STAFF_NOT_CONNECTED };
  }
  return { conversation };
}

const refuse = (refusal: Refusal) => error(refusal.statusCode, refusal.messages, refusal.errorCode);

/** SendMessageDto: a non-empty string of at most 4000 characters. */
const invalidContent = (content: unknown) =>
  typeof content !== "string" || !content.trim() ? "content should not be empty" : content.length > 4000 ? "content must be shorter than or equal to 4000 characters" : null;

function listFor(caller: Caller) {
  return conversations.filter((conversation) =>
    conversation.type === "staff_dm"
      ? caller.id === conversation.participantAId || caller.id === conversation.participantBId
      : caller.supportAccess || (caller.type === "customer" && caller.id === conversation.customerId),
  );
}

export const chatHandlers = [
  http.get("*/api/chat/conversations", ({ request }) => {
    const caller = callerFor(bearer(request));
    if (!caller) return error(401, ["Authentication failed"]);
    return ok(listFor(caller));
  }),

  http.get("*/api/chat/conversations/:id/messages", ({ params, request }) => {
    const caller = callerFor(bearer(request));
    if (!caller) return error(401, ["Authentication failed"]);
    const result = check(caller, String(params.id));
    if (!("conversation" in result)) return refuse(result);
    const query = new URL(request.url).searchParams;
    const page = Math.max(1, Number(query.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? 50)));
    const thread = messages
      .filter((message) => message.conversationId === result.conversation.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginated(thread, page, limit);
  }),

  http.post("*/api/chat/conversations/with/:internalUserId", ({ params, request }) => {
    const caller = callerFor(bearer(request));
    if (!caller) return error(401, ["Authentication failed"]);
    if (caller.type !== "staff") return error(403, ["This action is restricted to staff accounts"], NOT_INTERNAL_USER);
    const other = String(params.internalUserId);
    if (!areConnected(caller.id, other)) {
      return error(403, ["You must be connected contacts to message each other"], STAFF_NOT_CONNECTED);
    }
    const existing = conversations.find(
      (conversation) =>
        conversation.type === "staff_dm" &&
        [conversation.participantAId, conversation.participantBId].includes(caller.id) &&
        [conversation.participantAId, conversation.participantBId].includes(other),
    );
    return ok(existing ?? addDm(caller.id, other, new Date().toISOString()), 201);
  }),

  http.post("*/api/chat/support", ({ request }) => {
    const caller = callerFor(bearer(request));
    if (!caller) return error(401, ["Authentication failed"]);
    if (caller.type !== "customer") return error(403, ["This action is restricted to customer accounts"], NOT_CUSTOMER);
    const existing = conversations.find((conversation) => conversation.type === "support" && conversation.customerId === caller.id);
    return ok(existing ?? addSupport(caller.id, new Date().toISOString()), 201);
  }),

  // Saves the message but, like the backend, tells no one live: the socket's sendMessage does that.
  http.post("*/api/chat/conversations/:id/messages", async ({ params, request }) => {
    const caller = callerFor(bearer(request));
    if (!caller) return error(401, ["Authentication failed"]);
    const { content } = (await request.json()) as { content?: unknown };
    const invalid = invalidContent(content);
    if (invalid) return error(400, [invalid]);
    const result = check(caller, String(params.id), true);
    if (!("conversation" in result)) return refuse(result);
    return ok(addMessage(result.conversation, caller.id, caller.type, String(content), new Date().toISOString()), 201);
  }),

  http.patch("*/api/chat/conversations/:id/read", ({ params, request }) => {
    const caller = callerFor(bearer(request));
    if (!caller) return error(401, ["Authentication failed"]);
    const result = check(caller, String(params.id));
    if (!("conversation" in result)) return refuse(result);
    return ok<MessageResponse>({ message: "Conversation marked as read" });
  }),
];

const CANNED_REPLIES = [
  "Got it, thanks.",
  "On it. I'll update you in a few minutes.",
  "Sounds good to me.",
  "Thanks! Let me check and come back to you.",
];

/** The canned reply's author: the other staff member in a DM; in support, the customer (or support staff, if a customer wrote). */
function replierFor(conversation: Conversation, senderId: string): { id: string; type: AccountType } {
  if (conversation.type === "staff_dm") {
    return { id: conversation.participantAId === senderId ? conversation.participantBId! : conversation.participantAId!, type: "staff" };
  }
  return senderId === conversation.customerId ? { id: maya.id, type: "staff" } : { id: conversation.customerId!, type: "customer" };
}

/**
 * The in-memory socket. Same events as ChatGateway, for this tab only: you get
 * `message.new` for conversations you joined, and `support.message.new` for
 * support conversations if you have support access. (The real gateway also
 * sends staff DMs to the support pool; that's a backend bug, not copied here.)
 */
export function createMockChatConnection(): ChatConnection {
  const listeners = new Map<keyof ChatEvents, Set<(payload?: unknown) => void>>();
  const joined = new Set<string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let replies = 0;
  let connected = false;

  const emit = (event: keyof ChatEvents, payload?: unknown) => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };
  const later = (run: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, ms);
    timers.add(timer);
  };
  const me = () => callerFor(tokens.getAccess());
  const deliver = (message: ChatMessage, conversation: Conversation) => {
    if (joined.has(message.conversationId)) emit("message.new", message);
    if (conversation.type === "support" && me()?.supportAccess) {
      emit("support.message.new", { conversationId: conversation.id, preview: message.content.slice(0, 80) });
    }
  };
  const exception = (refusal: Refusal) => emit("exception", refusal);

  return {
    on(event, listener) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener as (payload?: unknown) => void);
      listeners.set(event, set);
      return () => void set.delete(listener as (payload?: unknown) => void);
    },
    join(conversationId) {
      const caller = me();
      if (!caller) return exception({ statusCode: 401, messages: ["WebSocket authentication failed"], errorCode: 11004 });
      const result = check(caller, conversationId);
      if (!("conversation" in result)) return exception(result);
      joined.add(conversationId);
    },
    leave(conversationId) {
      joined.delete(conversationId);
    },
    send(conversationId, content) {
      const caller = me();
      if (!caller) return exception({ statusCode: 401, messages: ["WebSocket authentication failed"], errorCode: 11004 });
      const invalid = invalidContent(content);
      if (invalid) return exception({ statusCode: 400, messages: [invalid] });
      const result = check(caller, conversationId, true);
      if (!("conversation" in result)) return exception(result);
      const { conversation } = result;

      later(() => deliver(addMessage(conversation, caller.id, caller.type, content, new Date().toISOString()), conversation), 60);
      const replier = replierFor(conversation, caller.id);
      const reply = CANNED_REPLIES[replies++ % CANNED_REPLIES.length]!;
      later(() => deliver(addMessage(conversation, replier.id, replier.type, reply, new Date().toISOString()), conversation), 1800);
    },
    connect() {
      later(() => {
        connected = true;
        emit("connect");
      }, 0);
    },
    close() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      connected = false;
      emit("disconnect");
      listeners.clear();
      joined.clear();
    },
    get connected() {
      return connected;
    },
  };
}
