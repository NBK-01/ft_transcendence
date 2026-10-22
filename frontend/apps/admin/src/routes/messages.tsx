import { MessageSquare, SearchX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { STAFF_NOT_CONNECTED, useChatConnected, useLiveChat, useStaffSession } from "@trans/api";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Button } from "@trans/ui/components/button";
import { Skeleton } from "@trans/ui/components/skeleton";
import { toast } from "@trans/ui/components/toaster";
import { cn } from "@trans/ui/lib/utils";

import { useBranchFilter } from "../features/branches/use-branch-filter";
import { ConversationList } from "../features/messages/conversation-list";
import { Thread } from "../features/messages/thread";
import { useConversationTitle } from "../features/messages/use-conversation-title";

/**
 * /messages and /messages/:id: staff-to-staff conversations, live. Wide
 * screens show the list beside the open thread; phones show one at a time.
 */
export function MessagesPage() {
  const { t } = useTranslation(["common", "app"]);
  const { id } = useParams();
  const { user } = useStaffSession();
  const { withBranch } = useBranchFilter();
  const { connection, conversations } = useLiveChat();
  const connected = useChatConnected(connection);
  const titleOf = useConversationTitle();

  const staff = useMemo(
    () =>
      (conversations.data ?? [])
        .filter((conversation) => conversation.type === "staff_dm")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [conversations.data],
  );
  const active = staff.find((conversation) => conversation.id === id);

  // Conversations that got a message from someone else while closed, until opened (this visit only).
  const [unseen, setUnseen] = useState<ReadonlySet<string>>(new Set());
  const openId = useRef(id);
  useEffect(() => {
    openId.current = id;
  }, [id]);
  const markSeen = (conversationId: string) =>
    setUnseen((previous) => {
      if (!previous.has(conversationId)) return previous;
      const next = new Set(previous);
      next.delete(conversationId);
      return next;
    });
  // Opened another way than a click in the list (Back, a link): seen too.
  const [seenId, setSeenId] = useState(id);
  if (id !== seenId) {
    setSeenId(id);
    if (id && unseen.has(id)) markSeen(id);
  }

  useEffect(() => {
    if (!connection) return;
    const offMessage = connection.on("message.new", (message) => {
      if (message.senderId === user?.id || message.conversationId === openId.current) return;
      setUnseen((previous) => new Set(previous).add(message.conversationId));
    });
    // A refused send. Access problems with a whole conversation show in the thread instead.
    const offException = connection.on("exception", (refusal) => {
      toast.error(t(refusal.errorCode === STAFF_NOT_CONNECTED ? "app:messages.notConnected" : "app:messages.sendError"));
    });
    return () => {
      offMessage();
      offException();
    };
  }, [connection, user?.id, t]);

  const header = <PageHeader title={t("nav.chat")} description={t("app:pages.messages")} />;

  if (conversations.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <title>{`${t("nav.chat")} · ${t("brand.name")}`}</title>
        {header}
        <span className="sr-only">{t("table.loading")}</span>
        <Skeleton className="h-[min(calc(100dvh-14rem),44rem)] min-h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (conversations.isError || staff.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <title>{`${t("nav.chat")} · ${t("brand.name")}`}</title>
        {header}
        {conversations.isError ? (
          <EmptyState
            icon={MessageSquare}
            title={t("table.errorTitle")}
            description={t("table.errorBody")}
            action={
              <Button variant="secondary" onClick={() => void conversations.refetch()}>
                {t("table.retry")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={MessageSquare}
            title={t("app:messages.empty.title")}
            description={t("app:messages.empty.body")}
            action={
              <Button variant="secondary" asChild>
                <Link to={withBranch("/contacts")}>{t("app:messages.empty.action")}</Link>
              </Button>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <title>{`${active ? titleOf(active).name : t("nav.chat")} · ${t("brand.name")}`}</title>
      {header}
      <div className="grid h-[min(calc(100dvh-14rem),44rem)] min-h-96 overflow-hidden rounded-xl border border-gray-alpha-400 bg-background-100 md:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Phones: the list, or the open thread. */}
        <div className={cn("min-h-0 border-gray-alpha-400 md:border-e", id && "max-md:hidden")}>
          <ConversationList
            conversations={staff}
            activeId={id}
            unseen={unseen}
            titleOf={titleOf}
            onOpen={markSeen}
          />
        </div>
        <div className={cn("min-h-0", !id && "max-md:hidden")}>
          {active ? (
            <Thread
              key={active.id}
              conversation={active}
              title={titleOf(active)}
              connection={connection}
              connected={connected}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                icon={id ? SearchX : MessageSquare}
                title={t(id ? "app:messages.notFound.title" : "app:messages.pick.title")}
                description={t(id ? "app:messages.notFound.body" : "app:messages.pick.body")}
                action={
                  id && (
                    <Button variant="secondary" asChild className="md:hidden">
                      <Link to={withBranch("/messages")}>{t("app:messages.back")}</Link>
                    </Button>
                  )
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
