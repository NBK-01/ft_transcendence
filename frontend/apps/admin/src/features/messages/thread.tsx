import { ArrowLeft, SendHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import {
  messagesOf,
  useMarkConversationRead,
  useMessages,
  useStaffSession,
  type ChatConnection,
  type ChatMessage,
  type Conversation,
} from "@trans/api";
import { Avatar } from "@trans/ui/components/avatar";
import { Button } from "@trans/ui/components/button";
import { Skeleton } from "@trans/ui/components/skeleton";
import { Textarea } from "@trans/ui/components/textarea";
import { cn } from "@trans/ui/lib/utils";

import { useBranchFilter } from "../branches/use-branch-filter";
import type { ConversationTitle } from "./use-conversation-title";

/** How close to the bottom still counts as "at the bottom", so new messages keep it scrolled down. */
const STICK_THRESHOLD = 80;

/**
 * One conversation: its messages (older pages on demand) and the send box.
 * Mount it with `key={conversation.id}`, so scroll state starts over per conversation.
 */
export function Thread({
  conversation,
  title,
  connection,
  connected,
}: {
  conversation: Conversation;
  title: ConversationTitle;
  connection: ChatConnection | null;
  connected: boolean;
}) {
  const { t } = useTranslation("app");
  const { withBranch } = useBranchFilter();
  const messages = useMessages(conversation.id);
  const thread = useMemo(() => messagesOf(messages.data), [messages.data]);

  // Read as you open it, and again as new messages arrive while it's open.
  const { mutate: markRead } = useMarkConversationRead();
  const latestId = thread.at(-1)?.id;
  useEffect(() => {
    if (latestId) markRead(conversation.id);
  }, [conversation.id, latestId, markRead]);

  return (
    <section aria-label={t("messages.threadLabel", { name: title.name })} className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-gray-alpha-400 px-4 py-3">
        <Button variant="tertiary" size="sm" shape="square" asChild className="md:hidden">
          <Link to={withBranch("/messages")} aria-label={t("messages.back")}>
            <ArrowLeft className="rtl:-scale-x-100" />
          </Link>
        </Button>
        <Avatar name={title.name} size="md" aria-hidden="true" online={title.online} />
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-label-16 text-gray-1000">
            {/* A colleague's name opens their profile; a customer has none here. */}
            {title.otherId ? (
              <Link
                to={withBranch(`/profile/${encodeURIComponent(title.otherId)}`)}
                className="focus-ring rounded-sm hover:underline"
              >
                {title.name}
              </Link>
            ) : (
              title.name
            )}
          </h2>
          <p className="truncate text-copy-13 text-gray-900" dir="ltr">
            {title.detail}
          </p>
        </div>
      </header>
      <MessageList
        messages={thread}
        support={title.support}
        isPending={messages.isPending}
        hasOlder={messages.hasNextPage}
        loadingOlder={messages.isFetchingNextPage}
        onLoadOlder={() => void messages.fetchNextPage()}
      />
      <Composer conversationId={conversation.id} connection={connection} connected={connected} />
    </section>
  );
}

function MessageList({
  messages,
  support,
  isPending,
  hasOlder,
  loadingOlder,
  onLoadOlder,
}: {
  messages: ChatMessage[];
  support: boolean;
  isPending: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}) {
  const { t, i18n } = useTranslation("app");
  const { user } = useStaffSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  // The scroll height before older messages went in on top, to keep your place.
  const heightBeforeOlder = useRef<number | null>(null);

  const locale = `${i18n.language}-u-nu-latn`;
  const time = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }), [locale]);
  const day = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  const dayLabel = (at: Date) => {
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (at.toDateString() === today.toDateString()) return t("messages.today");
    if (at.toDateString() === yesterday.toDateString()) return t("messages.yesterday");
    return day.format(at);
  };

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (heightBeforeOlder.current !== null) {
      element.scrollTop += element.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
    } else if (atBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages.length]);

  const loadOlder = () => {
    heightBeforeOlder.current = scrollRef.current?.scrollHeight ?? null;
    onLoadOlder();
  };

  if (isPending) {
    return (
      <div className="flex flex-1 flex-col justify-end gap-3 p-4" aria-busy="true">
        <span className="sr-only">{t("common:table.loading")}</span>
        <Skeleton className="h-10 w-2/3 rounded-2xl" />
        <Skeleton className="ms-auto h-10 w-1/2 rounded-2xl" />
        <Skeleton className="h-16 w-3/5 rounded-2xl" />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD;
      }}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4"
    >
      {hasOlder && (
        <Button variant="secondary" size="sm" className="mb-4 self-center" loading={loadingOlder} onClick={loadOlder}>
          {t("messages.loadOlder")}
        </Button>
      )}
      {messages.length === 0 ? (
        <p className="m-auto text-copy-14 text-gray-900">{t("messages.threadEmpty")}</p>
      ) : (
        // role="log": new messages are announced politely as they arrive.
        <ol role="log" aria-busy={loadingOlder} className="mt-auto flex flex-col gap-2">
          {messages.map((message, index) => {
            const at = new Date(message.createdAt);
            const previous = messages[index - 1];
            const newDay = !previous || new Date(previous.createdAt).toDateString() !== at.toDateString();
            const mine = message.senderId === user?.id;
            return (
              <li key={message.id} className="flex flex-col gap-2">
                {newDay && (
                  <p className="my-2 self-center rounded-full bg-gray-alpha-100 px-3 py-0.5 text-label-12 text-gray-900">
                    {dayLabel(at)}
                  </p>
                )}
                <div className={cn("flex max-w-[75%] flex-col gap-1", mine ? "items-end self-end" : "items-start self-start")}>
                  {/* In support, several staff can answer: label the other messages by side. */}
                  {support && !mine && (
                    <span className="text-label-12 text-gray-900">
                      {t(message.senderType === "customer" ? "messages.customer" : "messages.support")}
                    </span>
                  )}
                  <p
                    dir="auto"
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-copy-14 break-words whitespace-pre-wrap",
                      mine ? "rounded-ee-sm bg-gray-1000 text-background-100" : "rounded-es-sm bg-gray-alpha-100 text-gray-1000",
                    )}
                  >
                    {message.content}
                  </p>
                  <time dateTime={message.createdAt} className="text-label-12 text-gray-900 tabular-nums">
                    {time.format(at)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** The backend's SendMessageDto limit. */
const MAX_LENGTH = 4000;

function Composer({
  conversationId,
  connection,
  connected,
}: {
  conversationId: string;
  connection: ChatConnection | null;
  connected: boolean;
}) {
  const { t } = useTranslation("app");
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // "Connecting…" until the first connection; "Offline" only after it drops.
  const [wasConnected, setWasConnected] = useState(false);
  if (connected && !wasConnected) setWasConnected(true);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || !connection) return;
    // Over the socket: it's what tells the other side live. Our copy comes back as message.new.
    connection.send(conversationId, content);
    setDraft("");
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter is a new line; Enter while an IME is composing (e.g. Arabic, Chinese) isn't a send.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5 border-t border-gray-alpha-400 p-3">
      {!connected && (
        <p role="status" className="text-label-12 text-gray-900">
          {wasConnected ? t("messages.offline") : t("messages.connecting")}
        </p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("messages.composer.placeholder")}
          aria-label={t("messages.composer.label")}
          aria-describedby="composer-hint"
          maxLength={MAX_LENGTH}
          rows={1}
          dir="auto"
          className="max-h-40 min-h-10 flex-1 resize-none"
        />
        <Button type="submit" shape="square" disabled={!draft.trim()} aria-label={t("messages.composer.send")}>
          <SendHorizontal className="rtl:-scale-x-100" />
        </Button>
      </div>
      <p id="composer-hint" className="text-label-12 text-gray-700 max-sm:sr-only">
        {t("messages.composer.hint")}
      </p>
    </form>
  );
}
