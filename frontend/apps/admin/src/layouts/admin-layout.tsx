import { Building2, KeyRound, LayoutGrid, MessageSquare, Package, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useNavigate } from "react-router";

import { AppShell, type NavGroup } from "@trans/ui/blocks/app-shell";
import { Logo } from "@trans/ui/blocks/logo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trans/ui/components/select";

// Preview data until the API is wired.
const MOCK_USER = { name: "Youssef Benali", email: "youssef@shiptrack.example", role: "Administrator" };
const MOCK_BRANCHES = ["Casablanca — Maârif", "Rabat — Agdal", "Paris — 11e", "Lyon — Part-Dieu"];
const ALL = "all";

/**
 * Branch filter (Vercel's "project as filter" pattern): the same pages show
 * every branch or one branch, instead of separate per-branch pages.
 */
function BranchFilter() {
  const { t } = useTranslation("common");
  const [branch, setBranch] = useState(ALL);

  return (
    <Select value={branch} onValueChange={setBranch}>
      <SelectTrigger size="sm" className="w-56" aria-label={t("nav.branch")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("nav.allBranches")}</SelectItem>
        {MOCK_BRANCHES.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AdminLayout() {
  const { t } = useTranslation(["common", "app"]);
  const navigate = useNavigate();

  const nav: NavGroup[] = [
    {
      label: t("app:groups.operations"),
      items: [
        { to: "/", label: t("nav.dashboard"), icon: LayoutGrid, end: true },
        { to: "/shipments", label: t("nav.shipments"), icon: Package },
        { to: "/messages", label: t("nav.chat"), icon: MessageSquare },
      ],
    },
    {
      label: t("app:groups.manage"),
      items: [
        { to: "/users", label: t("nav.users"), icon: Users },
        { to: "/branches", label: t("nav.branches"), icon: Building2 },
        { to: "/api-keys", label: t("nav.apiKeys"), icon: KeyRound },
      ],
    },
  ];

  return (
    <AppShell
      brand={
        <Link to="/" className="focus-ring rounded-md" aria-label={t("brand.name")}>
          <Logo label={t("app:logoLabel")} />
        </Link>
      }
      nav={nav}
      user={MOCK_USER}
      profileHref="/profile"
      onSignOut={() => navigate("/login")}
      topbarStart={<BranchFilter />}
    >
      <Outlet />
    </AppShell>
  );
}
