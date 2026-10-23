import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { Conversation } from "@trans/api";
import { Avatar } from "@trans/ui/components/avatar";
import { cn } from "@trans/ui/lib/utils";

import { useBranchFilter } from "../branches/use-branch-filter";
import { useActivityTime } from "./use-activity-time";
import type { ConversationTitle } from "./use-conversation-title";

/** The conversations, latest activity first. A dot marks ones with messages that arrived while closed. */
export function ConversationList({
  conversations,
  activeId,
  unseen,
  titleOf,
  onOpen,
}: {
  conversations: Conversation[];
  activeId?: string;
  unseen: ReadonlySet<string>;
  titleOf: (conversation: Conversation) => ConversationTitle;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("app");
  const { withBranch } = useBranchFilter();
  const activity = useActivityTime();

  return (
    <nav aria-label={t("messages.listLabel")} className="h-full overflow-y-auto p-2">
      <ul className="flex flex-col gap-0.5">
        {conversations.map((conversation) => {
          const title = titleOf(conversation);
          const active = conversation.id === activeId;
          const isUnseen = unseen.has(conversation.id);
          return (
            <li key={conversation.id}>
              <Link
                to={withBranch(`/messages/${conversation.id}`)}
                onClick={() => onOpen(conversation.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors duration-150 hover:bg-gray-alpha-100",
                  active && "bg-gray-alpha-100",
                )}
              >
                <Avatar name={title.name} size="md" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("truncate text-label-14 text-gray-1000", isUnseen && "font-semibold")}>
                    {title.name}
                  </span>
                  <span className="truncate text-copy-13 text-gray-900" dir="ltr">
                    {title.detail}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <time dateTime={conversation.updatedAt} className="text-label-12 text-gray-900 tabular-nums">
                    {activity(conversation.updatedAt)}
                  </time>
                  {isUnseen && (
                    <span className="size-2 rounded-full bg-orange-700">
                      <span className="sr-only">{t("messages.newMessages")}</span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
