import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { addMessageToCache, messagesOf } from "./chat";
import { api, configureApi } from "./client";
import { keys } from "./keys";
import { createMockChatConnection } from "./mocks/chat";
import { internalUsers, MOCK_STAFF_PASSWORD } from "./mocks/data";
import { handlers } from "./mocks/handlers";
import { tokens } from "./session";
import type { AuthResponse, ChatMessage, Conversation, Page, StaffAuthResponse } from "./types";

const server = setupServer(...handlers);

const memoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
};

beforeAll(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  configureApi({ baseUrl: "http://api.test/api", getLanguage: () => "en", onSessionExpired: () => {} });
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => tokens.clear());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const staffNamed = (name: string) => internalUsers.find((user) => user.name === name)!;
const nadia = staffNamed("Nadia Haddad"); // admin: support access
const rami = staffNamed("Rami Khoury"); // dispatcher: no support access
const omar = staffNamed("Omar Fassi"); // not a contact of Rami's

async function signInAs(email: string) {
  const { user, ...pair } = await api.post<StaffAuthResponse>(
    "/staff-auth/login",
    { email, password: MOCK_STAFF_PASSWORD },
    { auth: false },
  );
  tokens.set(pair, user);
}

const conversations = () => api.get<Conversation[]>("/chat/conversations");
const dmWith = (list: Conversation[], id: string) =>
  list.find((conversation) => conversation.type === "staff_dm" && [conversation.participantAId, conversation.participantBId].includes(id))!;

describe("chat mocks match the backend", () => {
  it("staff see their DMs, plus every support conversation with support access; a customer sees theirs", async () => {
    await signInAs(nadia.email);
    const forNadia = await conversations();
    expect(forNadia.some((conversation) => conversation.type === "support")).toBe(true);
    expect(dmWith(forNadia, rami.id)).toBeDefined();

    await signInAs(rami.email);
    const forRami = await conversations();
    expect(forRami.every((conversation) => conversation.type === "staff_dm")).toBe(true);

    tokens.clear();
    const customer = await api.post<AuthResponse>("/auth/login", { email: "a@example.com", password: "x" }, { auth: false });
    tokens.set(customer);
    const forCustomer = await conversations();
    expect(forCustomer).toHaveLength(1);
    expect(forCustomer[0]).toMatchObject({ type: "support", customerId: customer.user.id });
  });

  it("messages come newest first, 50 a page", async () => {
    await signInAs(nadia.email);
    const long = dmWith(await conversations(), staffNamed("Youssef Benali").id);
    const first = await api.getPage<ChatMessage>(`/chat/conversations/${long.id}/messages`, { query: { page: 1, limit: 50 } });
    expect(first.items).toHaveLength(50);
    expect(first.meta.totalPages).toBe(2);
    expect(first.items[0]!.createdAt > first.items[1]!.createdAt).toBe(true);
  });

  it("refuses: unknown conversation 404 (11001), someone else's 403 (11002), a DM with a non-contact 403 (11003)", async () => {
    await signInAs(nadia.email);
    const support = (await conversations()).find((conversation) => conversation.type === "support")!;

    await signInAs(rami.email);
    await expect(api.get(`/chat/conversations/${support.id}/messages`)).rejects.toMatchObject({ status: 403, errorCode: 11002 });
    await expect(api.get("/chat/conversations/00000000-0000-4000-e000-0000000000ff/messages")).rejects.toMatchObject({
      status: 404,
      errorCode: 11001,
    });
    await expect(api.post(`/chat/conversations/with/${omar.id}`)).rejects.toMatchObject({ status: 403, errorCode: 11003 });
  });

  it("opening a DM with a contact returns the existing conversation", async () => {
    await signInAs(rami.email);
    const existing = dmWith(await conversations(), nadia.id);
    await expect(api.post<Conversation>(`/chat/conversations/with/${nadia.id}`)).resolves.toMatchObject({ id: existing.id });
  });
});

describe("the in-memory chat connection", () => {
  afterEach(() => void vi.useRealTimers());

  it("delivers your message, then the other side's reply, to a joined conversation", async () => {
    await signInAs(nadia.email);
    const conversation = dmWith(await conversations(), rami.id);
    vi.useFakeTimers();
    const connection = createMockChatConnection();
    const received: ChatMessage[] = [];
    connection.on("message.new", (message) => void received.push(message));
    connection.join(conversation.id);

    connection.send(conversation.id, "Hello from the test");
    await vi.advanceTimersByTimeAsync(100);
    expect(received.map((message) => [message.senderId, message.content])).toEqual([[nadia.id, "Hello from the test"]]);

    await vi.advanceTimersByTimeAsync(2000);
    expect(received[1]).toMatchObject({ senderId: rami.id, conversationId: conversation.id });
    connection.close();
  });

  it("refuses an empty message and a conversation you can't see, as `exception`", async () => {
    await signInAs(rami.email);
    const connection = createMockChatConnection();
    const refusals: unknown[] = [];
    connection.on("exception", (refusal) => void refusals.push(refusal));

    connection.send(dmWith(await conversations(), nadia.id).id, "   ");
    connection.join("00000000-0000-4000-e000-0000000000ff");
    expect(refusals).toEqual([
      expect.objectContaining({ statusCode: 400 }),
      expect.objectContaining({ statusCode: 404, errorCode: 11001 }),
    ]);
    connection.close();
  });
});

describe("chat cache", () => {
  const message = (id: string, createdAt: string, conversationId = "c1"): ChatMessage => ({
    id,
    conversationId,
    senderId: "s",
    senderType: "staff",
    content: id,
    createdAt,
  });
  const page = (items: ChatMessage[], number: number): Page<ChatMessage> => ({
    items,
    meta: { page: number, limit: 2, totalItems: 4, totalPages: 2 },
  });

  it("messagesOf: oldest first, without the duplicates a shifted page brings", () => {
    const data: InfiniteData<Page<ChatMessage>> = {
      pages: [page([message("m3", "2026-10-21T10:03"), message("m2", "2026-10-21T10:02")], 1), page([message("m2", "2026-10-21T10:02"), message("m1", "2026-10-21T10:01")], 2)],
      pageParams: [1, 2],
    };
    expect(messagesOf(data).map((item) => item.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("addMessageToCache: onto the newest page once, moves the conversation's activity, says if it's known", () => {
    const client = new QueryClient();
    client.setQueryData(keys.chat.messages("c1"), { pages: [page([message("m1", "2026-10-21T10:01")], 1)], pageParams: [1] });
    client.setQueryData<Conversation[]>(keys.chat.conversations(), [
      { id: "c1", type: "staff_dm", createdAt: "2026-10-21T09:00", updatedAt: "2026-10-21T10:01" },
    ]);

    expect(addMessageToCache(client, message("m2", "2026-10-21T10:02"))).toBe(true);
    addMessageToCache(client, message("m2", "2026-10-21T10:02"));
    const thread = client.getQueryData<InfiniteData<Page<ChatMessage>>>(keys.chat.messages("c1"));
    expect(thread?.pages[0]?.items.map((item) => item.id)).toEqual(["m2", "m1"]);
    expect(client.getQueryData<Conversation[]>(keys.chat.conversations())?.[0]?.updatedAt).toBe("2026-10-21T10:02");

    expect(addMessageToCache(client, message("x", "2026-10-21T10:05", "new"))).toBe(false);
  });
});
