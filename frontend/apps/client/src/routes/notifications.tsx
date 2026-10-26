import { CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useMarkAllNotificationsRead, useUnreadNotificationCount } from "@trans/api";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Button } from "@trans/ui/components/button";
import { toast } from "@trans/ui/components/toaster";

import { NotificationList } from "../features/notifications/notification-list";

/** /app/notifications: every update about your shipments and account, newest first. */
export function NotificationsPage() {
  const { t } = useTranslation(["common", "app"]);
  const count = useUnreadNotificationCount().data?.count ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("nav.notifications")} · ${t("brand.name")}`}</title>
      <PageHeader title={t("nav.notifications")} description={t("app:pages.notifications")} actions={<MarkAllRead hasUnread={count > 0} />} />
      <NotificationList />
    </div>
  );
}

function MarkAllRead({ hasUnread }: { hasUnread: boolean }) {
  const { t } = useTranslation("app");
  const { mutate: markAll } = useMarkAllNotificationsRead();
  return (
    <Button
      variant="secondary"
      prefix={<CheckCheck aria-hidden="true" />}
      // aria-disabled rather than disabled: focus stays on it once everything is read.
      aria-disabled={!hasUnread || undefined}
      onClick={() => {
        if (!hasUnread) return;
        markAll(undefined, { onError: () => toast.error(t("notifications.markAllError")) });
      }}
    >
      {t("notifications.markAllRead")}
    </Button>
  );
}
