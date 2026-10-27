import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { useChatConnection, useLiveNotifications } from "@trans/api";
import { toast } from "@trans/ui/components/toaster";

import { useDescribeNotification } from "./notification-kinds";

/**
 * Keeps the tab's socket open while signed in (any page, not only Messages),
 * and shows each new notification as a toast linking to what it's about. Not
 * for the reader's own actions (where they acted already said so), nor for
 * new messages while the inbox is open (it marks them itself).
 */
export function useNotificationToasts() {
  const { t } = useTranslation("app");
  const connection = useChatConnection();
  const describe = useDescribeNotification();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useLiveNotifications(connection, (notification) => {
    if (notification.ownAction) return;
    if (notification.type === "MESSAGE_RECEIVED" && pathname.startsWith("/messages")) return;
    const { title, message, href } = describe(notification);
    toast(title, {
      description: message,
      action: href ? { label: t("notifications.open"), onClick: () => void navigate(href) } : undefined,
    });
  });
}
