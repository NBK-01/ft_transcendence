import { Bell, MessageSquare, Package, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";

import { useLogout, useSession } from "@trans/api";
import { AppShell, type NavGroup } from "@trans/ui/blocks/app-shell";
import { Logo } from "@trans/ui/blocks/logo";
import { Button } from "@trans/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@trans/ui/components/tooltip";

export function ClientLayout() {
  const { t } = useTranslation("common");
  const session = useSession();
  const signOut = useLogout();

  const nav: NavGroup[] = [
    {
      items: [
        { to: "/app", label: t("nav.shipments"), icon: Package, end: true },
        { to: "/app/messages", label: t("nav.chat"), icon: MessageSquare },
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
      <Outlet />
    </AppShell>
  );
}
