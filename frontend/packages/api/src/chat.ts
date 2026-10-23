import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

import { useChatConnection } from "./chat-socket";
import { api } from "./client";
import { keys } from "./keys";
import type { ChatMessage, Conversation, MessageResponse, Page } from "./types";

/** Messages per page, the backend's default. */
export const MESSAGES_PAGE_SIZE = 50;

/** Backend ChatErrorCodes. */
export const CONVERSATION_NOT_FOUND = 11001;
export const NOT_CONVERSATION_PARTICIPANT = 11002;
export const STAFF_NOT_CONNECTED = 11003;

/**
 * GET /chat/conversations: staff get their DMs, plus every support
 * conversation with `chat:support:access`; a customer gets their support
 * conversation. `updatedAt` is moved forward locally when a message arrives,
 * so sorting by it puts the latest activity first.
 */
export function useConversations({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.chat.conversations(),
    queryFn: ({ signal }) => api.get<Conversation[]>("/chat/conversations", { signal }),
    enabled,
  });
}

/** GET /chat/conversations/:id/messages, newest page first; `messagesOf` turns it into a thread. */
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: keys.chat.messages(conversationId),
    queryFn: ({ pageParam, signal }) =>
      api.getPage<ChatMessage>(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
        query: { page: pageParam, limit: MESSAGES_PAGE_SIZE },
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last: Page<ChatMessage>) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: Boolean(conversationId),
  });
}

/**
 * The pages as one thread, oldest first. Live messages shift the backend's
 * offset pages, so an older page can repeat a message: duplicates are dropped.
 */
export function messagesOf(data: InfiniteData<Page<ChatMessage>> | undefined): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const page of data?.pages ?? []) for (const message of page.items) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** POST /chat/conversations/with/:id: opens (or finds) the DM with a contact. 403 (11003) if you aren't connected. */
export function useOpenStaffConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (internalUserId: string) =>
      api.post<Conversation>(`/chat/conversations/with/${encodeURIComponent(internalUserId)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.chat.conversations() }),
  });
}

/** PATCH /chat/conversations/:id/read. Fire and forget: a failure only leaves it unread on the server. */
export function useMarkConversationRead() {
  return useMutation({
    mutationFn: (conversationId: string) =>
      api.patch<MessageResponse>(`/chat/conversations/${encodeURIComponent(conversationId)}/read`),
  });
}

/**
 * A message from the socket, into the cache: on the newest page of its thread
 * (if that thread was loaded) and as its conversation's latest activity.
 * Returns false when the conversation isn't in the list yet (a new one).
 */
export function addMessageToCache(queryClient: QueryClient, message: ChatMessage) {
  queryClient.setQueryData<InfiniteData<Page<ChatMessage>>>(keys.chat.messages(message.conversationId), (data) => {
    if (!data?.pages[0] || data.pages.some((page) => page.items.some((item) => item.id === message.id))) return data;
    const [newest, ...older] = data.pages;
    return { ...data, pages: [{ ...newest, items: [message, ...newest.items] }, ...older] };
  });

  let known = false;
  queryClient.setQueryData<Conversation[]>(keys.chat.conversations(), (conversations) =>
    conversations?.map((conversation) => {
      if (conversation.id !== message.conversationId) return conversation;
      known = true;
      return message.createdAt > conversation.updatedAt ? { ...conversation, updatedAt: message.createdAt } : conversation;
    }),
  );
  return known;
}

/**
 * Keeps chat live while mounted: joins every conversation in the list (so new
 * messages arrive even in ones that aren't open), adds `message.new` to the
 * cache, and refetches the list when a message arrives for a conversation it
 * doesn't know (e.g. a new support conversation). Returns the connection for
 * sending and for listening to more events.
 */
export function useLiveChat() {
  const queryClient = useQueryClient();
  const connection = useChatConnection();
  const conversations = useConversations();

  useEffect(() => {
    if (!connection) return;
    for (const conversation of conversations.data ?? []) connection.join(conversation.id);
  }, [connection, conversations.data]);

  useEffect(() => {
    if (!connection) return;
    const refetchIfNew = (conversationId: string) => {
      const list = queryClient.getQueryData<Conversation[]>(keys.chat.conversations());
      if (list && !list.some((conversation) => conversation.id === conversationId)) {
        void queryClient.invalidateQueries({ queryKey: keys.chat.conversations() });
      }
    };
    const offMessage = connection.on("message.new", (message) => {
      if (!addMessageToCache(queryClient, message)) refetchIfNew(message.conversationId);
    });
    // Only people with support access get this; a support conversation that's new to the list appears.
    const offSupport = connection.on("support.message.new", ({ conversationId }) => refetchIfNew(conversationId));
    return () => {
      offMessage();
      offSupport();
    };
  }, [connection, queryClient]);

  return { connection, conversations };
}
