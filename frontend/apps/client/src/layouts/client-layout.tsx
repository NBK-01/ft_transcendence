import { Bell, MessageSquare, Package, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useNavigate } from "react-router";

import { AppShell, type NavGroup } from "@trans/ui/blocks/app-shell";
import { Logo } from "@trans/ui/blocks/logo";
import { Button } from "@trans/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@trans/ui/components/tooltip";

// Preview user until auth is wired to the backend.
const MOCK_USER = { name: "Amina El Idrissi", email: "amina@example.com" };

export function ClientLayout() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

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
      user={MOCK_USER}
      profileHref="/app/profile"
      onSignOut={() => navigate("/login")}
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
