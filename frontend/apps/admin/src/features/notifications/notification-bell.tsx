import { Bell, CheckCheck } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { useMarkAllNotificationsRead, useUnreadNotificationCount } from "@trans/api";
import { Badge } from "@trans/ui/components/badge";
import { Button } from "@trans/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@trans/ui/components/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@trans/ui/components/sheet";
import { toast } from "@trans/ui/components/toaster";
import { useMediaQuery } from "@trans/ui/hooks/use-media-query";

import { NotificationList } from "./notification-list";

/** Tailwind's md, where the shell switches from the phone layout (bottom bar) to the sidebar. */
const WIDE = "(min-width: 48rem)";

/**
 * The top bar's bell, for every role: the unread count (polled, see
 * useUnreadNotificationCount) and, once opened, the latest notifications.
 * Wide screens get a popover under the bell; phones a bottom sheet, like the
 * shell's "More" sheet, since a popover would be cramped at that width.
 * Escape or closing sends focus back to the bell either way.
 */
export function NotificationBell() {
  const { t } = useTranslation(["app", "common"]);
  const [open, setOpen] = useState(false);
  const wide = useMediaQuery(WIDE);
  const titleId = useId();
  const count = useUnreadNotificationCount().data?.count ?? 0;
  const close = () => setOpen(false);

  const trigger = (
    <Button
      variant="tertiary"
      size="sm"
      shape="square"
      aria-label={count > 0 ? t("notifications.bellLabel", { count }) : t("common:nav.notifications")}
    >
      <Bell aria-hidden="true" />
      {count > 0 && (
        <Badge
          variant="brand"
          size="sm"
          aria-hidden="true"
          className="absolute -end-1 -top-1 h-4 min-w-4 justify-center px-1 ring-2 ring-background-100"
        >
          {count > 9 ? "9+" : count}
        </Badge>
      )}
    </Button>
  );
  const title = t("common:nav.notifications");

  if (wide) {
    return (
      // Modal, like the menus: Tab stays in the panel until it closes.
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="end" aria-labelledby={titleId} className="flex w-96 flex-col p-0">
          <div className="flex items-center gap-2 border-b border-gray-alpha-400 py-2 ps-4 pe-2">
            <h2 id={titleId} className="text-heading-16">
              {title}
            </h2>
            <MarkAllRead hasUnread={count > 0} />
          </div>
          <NotificationList onNavigate={close} className="max-h-[min(28rem,calc(100dvh-8rem))]" />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader className="flex-row items-center gap-2 border-b border-gray-alpha-400 py-3">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">{t("notifications.description")}</SheetDescription>
          <MarkAllRead hasUnread={count > 0} />
        </SheetHeader>
        <NotificationList onNavigate={close} className="min-h-0 flex-1" />
      </SheetContent>
    </Sheet>
  );
}

function MarkAllRead({ hasUnread }: { hasUnread: boolean }) {
  const { t } = useTranslation("app");
  const { mutate: markAll } = useMarkAllNotificationsRead();
  return (
    <Button
      variant="tertiary"
      size="sm"
      className="ms-auto"
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
