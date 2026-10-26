import { BellOff, CircleAlert, X } from "lucide-react";
import { useEffect, useMemo, useRef, type KeyboardEvent, type MouseEvent } from "react";
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
import { Card } from "@trans/ui/components/card";
import { Skeleton } from "@trans/ui/components/skeleton";
import { toast } from "@trans/ui/components/toaster";
import { cn } from "@trans/ui/lib/utils";

import { formatAbsolute, formatRelative } from "../shipments/format-time";
import { useDescribeNotification, type NotificationView } from "./notification-kinds";

/** Each row's main control (its link or button), and its dismiss button. */
const ROW = "[data-notification-row]";
const DISMISS = "[data-notification-dismiss]";

/**
 * The full feed on /app/notifications: newest first, with "Load more" while
 * there are older ones, like admin's bell panel but as a page instead of a
 * popover (this app has a dedicated route rather than a dropdown).
 */
export function NotificationList() {
  const { t } = useTranslation(["app", "common"]);
  const notifications = useNotifications();
  const items = useMemo(() => notificationsOf(notifications.data), [notifications.data]);
  const describe = useDescribeNotification();
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

  const open = (notification: AppNotification) => {
    if (notification.status !== "READ") markRead(notification.id);
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
      <Card className="divide-y divide-gray-alpha-400 overflow-hidden" aria-busy="true">
        <span className="sr-only">{t("common:table.loading")}</span>
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-start gap-3 px-4 py-4">
            <span className="size-2 shrink-0" />
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </Card>
    );
  }

  // A failed refresh keeps the rows on screen; only a first load that failed shows the error.
  if (notifications.isError && notifications.data === undefined) {
    return (
      <EmptyState
        icon={CircleAlert}
        title={t("common:table.errorTitle")}
        description={t("common:table.errorBody")}
        action={
          <Button variant="secondary" loading={notifications.isFetching} onClick={() => void notifications.refetch()}>
            {t("common:table.retry")}
          </Button>
        }
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState icon={BellOff} title={t("notifications.emptyTitle")} description={t("notifications.emptyBody")} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <ul
          ref={listRef}
          onKeyDown={moveBetweenRows}
          aria-busy={notifications.isFetchingNextPage}
          className="divide-y divide-gray-alpha-400"
        >
          {items.map((notification) => {
            const view = describe(notification);
            return (
              <NotificationRow
                key={notification.id}
                notification={notification}
                view={view}
                onOpen={() => open(notification)}
                onDismiss={(event) => remove(notification, event)}
              />
            );
          })}
        </ul>
      </Card>
      {notifications.hasNextPage && (
        <Button
          variant="secondary"
          className="self-center"
          loading={notifications.isFetchingNextPage}
          onClick={loadMore}
        >
          {t("notifications.loadMore")}
        </Button>
      )}
    </div>
  );
}

/**
 * One notification: a link to its page (or a button, when it has none) that
 * marks it read, and a dismiss button beside it. Unread shows three ways: a
 * dot, a bolder title, and "Unread" for screen readers.
 */
function NotificationRow({
  notification,
  view,
  onOpen,
  onDismiss,
}: {
  notification: AppNotification;
  view: NotificationView;
  onOpen: () => void;
  onDismiss: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { t, i18n } = useTranslation("app");
  const unread = notification.status !== "READ";
  const Icon = view.icon;
  // The backend's English, when there's no wording here: its own language and direction.
  const text = view.fallback ? ({ lang: "en", dir: "auto" } as const) : {};

  const body = (
    <>
      {unread && <span className="sr-only">{t("notifications.unread")}</span>}
      <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-orange-700" : "bg-transparent")} />
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gray-alpha-100 text-gray-900">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span {...text} className={cn("text-label-14 break-words text-gray-1000", unread && "font-semibold")}>
          {view.title}
        </span>
        <span {...text} className="break-words text-copy-14 text-gray-900">
          {view.message}
        </span>
        <time
          dateTime={notification.createdAt}
          title={formatAbsolute(notification.createdAt, i18n.language)}
          className="text-label-12 text-gray-900 tabular-nums"
        >
          {formatRelative(notification.createdAt, i18n.language)}
        </time>
      </span>
    </>
  );
  const rowClasses = "focus-ring flex min-w-0 flex-1 cursor-pointer items-start gap-3 px-4 py-4 text-start";

  return (
    <li className="flex items-start transition-colors duration-150 hover:bg-gray-alpha-100">
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
        className="me-3 mt-4 text-gray-900"
        aria-label={t("notifications.dismiss", { title: view.title })}
        data-notification-dismiss=""
        onClick={onDismiss}
      >
        <X />
      </Button>
    </li>
  );
}
