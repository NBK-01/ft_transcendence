import { BellOff, CircleAlert, X } from "lucide-react";
import { useEffect, useMemo, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import {
  isApiError,
  NOTIFICATION_NOT_FOUND,
  notificationsOf,
  useDismissNotification,
  useMarkNotificationRead,
  useNotifications,
  type AppNotification,
} from "@trans/api";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { Button } from "@trans/ui/components/button";
import { Skeleton } from "@trans/ui/components/skeleton";
import { toast } from "@trans/ui/components/toaster";
import { cn } from "@trans/ui/lib/utils";

import { useActivityTime } from "../messages/use-activity-time";
import { useDescribeNotification, type NotificationView } from "./notification-kinds";

/** Each row's main control (its link or button), and its dismiss button. */
const ROW = "[data-notification-row]";
const DISMISS = "[data-notification-dismiss]";

/**
 * The latest notifications, newest first, with "Load more" while there are
 * older ones. Mounted only while the bell's panel is open, so the list is
 * fetched when it opens (and again on reopening once it's stale), not before.
 */
export function NotificationList({ onNavigate, className }: { onNavigate: () => void; className?: string }) {
  const { t } = useTranslation(["app", "common"]);
  const notifications = useNotifications();
  const items = useMemo(() => notificationsOf(notifications.data), [notifications.data]);
  const describe = useDescribeNotification();
  const activity = useActivityTime();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: dismiss } = useDismissNotification();
  const listRef = useRef<HTMLUListElement>(null);
  // The first row "Load more" added: focus goes there, since the button may be gone.
  const firstNew = useRef<number | null>(null);

  useEffect(() => {
    const index = firstNew.current;
    if (index === null || notifications.isFetchingNextPage) return;
    firstNew.current = null;
    listRef.current?.querySelectorAll<HTMLElement>(ROW)[index]?.focus();
  }, [items.length, notifications.isFetchingNextPage]);

  const loadMore = () => {
    firstNew.current = items.length;
    void notifications.fetchNextPage();
  };

  const open = (notification: AppNotification, view: NotificationView) => {
    if (notification.status !== "READ") markRead(notification.id);
    if (view.href) onNavigate();
  };

  const remove = (notification: AppNotification, event: MouseEvent<HTMLButtonElement>) => {
    // The row is about to go: the same button on the next row (or the previous) takes the focus.
    const row = event.currentTarget.closest("li");
    const neighbour = row?.nextElementSibling ?? row?.previousElementSibling;
    neighbour?.querySelector<HTMLElement>(DISMISS)?.focus();
    dismiss(notification.id, {
      // A 404: dismissed already (in another tab), so it's gone as asked.
      onError: (error) => {
        if (!(isApiError(error) && error.errorCode === NOTIFICATION_NOT_FOUND)) toast.error(t("notifications.dismissError"));
      },
    });
  };

  /** Up and down move between rows, as well as Tab. */
  const moveBetweenRows = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const row = (event.target as HTMLElement).closest("li");
    const next = event.key === "ArrowDown" ? row?.nextElementSibling : row?.previousElementSibling;
    const target = next?.querySelector<HTMLElement>(ROW);
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  if (notifications.isPending) {
    return (
      <div className={cn("flex flex-col gap-0.5 p-2", className)} aria-busy="true">
        <span className="sr-only">{t("common:table.loading")}</span>
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-start gap-2.5 py-2.5 ps-2 pe-3">
            <span className="size-2 shrink-0" />
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // A failed refresh keeps the rows on screen; only a first load that failed shows the error.
  if (notifications.isError && notifications.data === undefined) {
    return (
      <PanelState className={className}>
        <EmptyState
          icon={CircleAlert}
          title={t("common:table.errorTitle")}
          description={t("common:table.errorBody")}
          className="border-none py-10"
          action={
            <Button variant="secondary" size="sm" loading={notifications.isFetching} onClick={() => void notifications.refetch()}>
              {t("common:table.retry")}
            </Button>
          }
        />
      </PanelState>
    );
  }

  if (items.length === 0) {
    return (
      <PanelState className={className}>
        <EmptyState
          icon={BellOff}
          title={t("notifications.emptyTitle")}
          description={t("notifications.emptyBody")}
          className="border-none py-10"
        />
      </PanelState>
    );
  }

  return (
    <div className={cn("overflow-y-auto", className)}>
      <ul
        ref={listRef}
        onKeyDown={moveBetweenRows}
        aria-busy={notifications.isFetchingNextPage}
        className="flex flex-col gap-0.5 p-2"
      >
        {items.map((notification) => {
          const view = describe(notification);
          return (
            <NotificationRow
              key={notification.id}
              notification={notification}
              view={view}
              time={activity(notification.createdAt)}
              onOpen={() => open(notification, view)}
              onDismiss={(event) => remove(notification, event)}
            />
          );
        })}
      </ul>
      {notifications.hasNextPage && (
        <div className="px-2 pb-2">
          <Button variant="secondary" size="sm" className="w-full" loading={notifications.isFetchingNextPage} onClick={loadMore}>
            {t("notifications.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

function PanelState({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("overflow-y-auto p-2", className)}>{children}</div>;
}

/**
 * One notification: a link to its page (or a button, when it has none) that
 * marks it read, and a dismiss button beside it. Unread shows three ways: a
 * dot, a bolder title, and "Unread" for screen readers.
 */
function NotificationRow({
  notification,
  view,
  time,
  onOpen,
  onDismiss,
}: {
  notification: AppNotification;
  view: NotificationView;
  time: string;
  onOpen: () => void;
  onDismiss: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useTranslation("app");
  const unread = notification.status !== "READ";
  const Icon = view.icon;
  // The backend's English, when there's no wording here: its own language and direction.
  const text = view.fallback ? ({ lang: "en", dir: "auto" } as const) : {};

  const body = (
    <>
      {unread && <span className="sr-only">{t("notifications.unread")}</span>}
      <span
        aria-hidden="true"
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-orange-700" : "bg-transparent")}
      />
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gray-alpha-100 text-gray-900">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span {...text} className={cn("text-label-14 break-words text-gray-1000", unread && "font-semibold")}>
          {view.title}
        </span>
        <span {...text} className="line-clamp-2 text-copy-13 break-words text-gray-900">
          {view.message}
        </span>
        <time dateTime={notification.createdAt} className="text-label-12 text-gray-900 tabular-nums">
          {time}
        </time>
      </span>
    </>
  );
  const rowClasses = "focus-ring flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-lg py-2.5 ps-2 pe-1 text-start";

  return (
    <li className="flex items-start gap-1 rounded-lg transition-colors duration-150 hover:bg-gray-alpha-100">
      {view.href ? (
        <Link to={view.href} onClick={onOpen} data-notification-row="" className={rowClasses}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} data-notification-row="" className={rowClasses}>
          {body}
        </button>
      )}
      <Button
        variant="tertiary"
        size="tiny"
        shape="square"
        className="me-1.5 mt-2.5 text-gray-900"
        aria-label={t("notifications.dismiss", { title: view.title })}
        data-notification-dismiss=""
        onClick={onDismiss}
      >
        <X />
      </Button>
    </li>
  );
}
