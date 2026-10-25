import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useChatConnected, useLiveChat, useSupportConversation } from "@trans/api";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Button } from "@trans/ui/components/button";
import { Skeleton } from "@trans/ui/components/skeleton";

import { SupportThread } from "../features/messages/support-thread";

/**
 * /app/messages: the customer's one support conversation, found-or-created on
 * load. Unlike admin's messages page there's no list/tabs — just the thread.
 */
export function MessagesPage() {
  const { t } = useTranslation(["common", "app"]);
  const support = useSupportConversation();
  const { connection } = useLiveChat();
  const connected = useChatConnected(connection);

  const header = <PageHeader title={t("nav.chat")} description={t("app:pages.messages")} />;

  if (support.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <title>{`${t("nav.chat")} · ${t("brand.name")}`}</title>
        {header}
        <span className="sr-only">{t("table.loading")}</span>
        <Skeleton className="h-[min(calc(100dvh-14rem),44rem)] min-h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (support.isError || !support.data) {
    return (
      <div className="flex flex-col gap-6">
        <title>{`${t("nav.chat")} · ${t("brand.name")}`}</title>
        {header}
        <EmptyState
          icon={MessageSquare}
          title={t("table.errorTitle")}
          description={t("table.errorBody")}
          action={
            <Button variant="secondary" onClick={() => void support.refetch()}>
              {t("table.retry")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <title>{`${t("nav.chat")} · ${t("brand.name")}`}</title>
      {header}
      <div className="h-[min(calc(100dvh-14rem),44rem)] min-h-96 overflow-hidden rounded-xl border border-gray-alpha-400 bg-background-100">
        <SupportThread conversation={support.data} connection={connection} connected={connected} />
      </div>
    </div>
  );
}
