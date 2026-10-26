import { Bell, MessageSquare, Package, UserRound } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router";

import { useLiveChat, useLogout, useSession } from "@trans/api";
import { AppShell, type NavGroup } from "@trans/ui/blocks/app-shell";
import { Logo } from "@trans/ui/blocks/logo";
import { Button } from "@trans/ui/components/button";
import { Skeleton } from "@trans/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@trans/ui/components/tooltip";

const MESSAGES_PATH = "/app/messages";

/**
 * A dot on the Messages nav item for a support reply that arrived while
 * elsewhere in the app — cleared on visiting the page, this visit only (same
 * spirit as admin's per-conversation unseen tracking, just a single boolean
 * since a customer only ever has the one conversation).
 */
function useUnseenSupportMessage() {
  const { user } = useSession();
  const { connection } = useLiveChat();
  const location = useLocation();
  const [unseen, setUnseen] = useState(false);

  // Adjust state during render (not in an effect) when the path just changed to
  // the messages page — see https://react.dev/learn/you-might-not-need-an-effect.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname);
    if (location.pathname === MESSAGES_PATH) setUnseen(false);
  }

  useEffect(() => {
    if (!connection) return;
    return connection.on("message.new", (message) => {
      if (message.senderId !== user?.id && location.pathname !== MESSAGES_PATH) setUnseen(true);
    });
  }, [connection, user?.id, location.pathname]);

  return unseen;
}

export function ClientLayout() {
  const { t } = useTranslation("common");
  const session = useSession();
  const signOut = useLogout();
  const unseenSupportMessage = useUnseenSupportMessage();

  const nav: NavGroup[] = [
    {
      items: [
        { to: "/app", label: t("nav.shipments"), icon: Package, end: true },
        {
          to: MESSAGES_PATH,
          label: t("nav.chat"),
          icon: MessageSquare,
          // undefined, not false: the shell draws a badge (or a dot) for anything else.
          badge: unseenSupportMessage ? (
            <span aria-label={t("nav.unread")} className="size-2 rounded-full bg-orange-700" />
          ) : undefined,
        },
        { to: "/app/notifications", label: t("nav.notifications"), icon: Bell },
        { to: "/app/profile", label: t("nav.profile"), icon: UserRound },
      ],
    },
  ];

  return (
    <AppShell
      brand={
        <Link to="/app" className="focus-ring rounded-md" aria-label={t("brand.name")}>
          <Logo />
        </Link>
      }
      nav={nav}
      user={{
        name: session.user?.name ?? "",
        email: session.user?.email ?? "",
        avatarUrl: session.user?.avatarUrl,
      }}
      profileHref="/app/profile"
      // RequireCustomer takes it from here: it shows /login once the session is gone.
      onSignOut={signOut}
      topbarEnd={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="tertiary" size="sm" shape="square" asChild>
              <Link to="/app/notifications" aria-label={t("nav.notifications")}>
                <Bell aria-hidden="true" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("nav.notifications")}</TooltipContent>
        </Tooltip>
      }
    >
      {/* Pages load their code on first visit (see router.tsx). */}
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

/** While a page's code loads on a first visit: the shape of a page header and its table. */
function PageSkeleton() {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <span className="sr-only">{t("table.loading")}</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
