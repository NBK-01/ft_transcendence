import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { useChatConnection, useLiveNotifications } from "@trans/api";
import { toast } from "@trans/ui/components/toaster";

import { useDescribeNotification } from "./notification-kinds";

const MESSAGES_PATH = "/app/messages";

/**
 * Shows each new notification as a toast linking to what it's about, over
 * the tab's socket. Not for the customer's own actions (where they acted
 * already said so), nor for support's replies while Messages is open.
 */
export function useNotificationToasts() {
  const { t } = useTranslation("app");
  const connection = useChatConnection();
  const describe = useDescribeNotification();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useLiveNotifications(connection, (notification) => {
    if (notification.ownAction) return;
    if (notification.type === "MESSAGE_RECEIVED" && pathname === MESSAGES_PATH) return;
    const { title, message, href } = describe(notification);
    toast(title, {
      description: message,
      action: href ? { label: t("notifications.open"), onClick: () => void navigate(href) } : undefined,
    });
  });
}
