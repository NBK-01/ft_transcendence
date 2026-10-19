import { Building2, KeyRound, LayoutGrid, MessageSquare, Package, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useNavigate } from "react-router";

import { AppShell, type NavGroup } from "@trans/ui/blocks/app-shell";
import { Logo } from "@trans/ui/blocks/logo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trans/ui/components/select";

import { useOrganizations } from "../features/branches/api";
import { useBranchFilter } from "../features/branches/use-branch-filter";

// Preview data until staff login is wired.
const MOCK_USER = { name: "Youssef Benali", email: "youssef@shiptrack.example", role: "Administrator" };
const ALL = "all";

/**
 * Branch filter (Vercel's "project as filter" pattern): the same pages show
 * every branch or one branch, instead of separate per-branch pages.
 * Kept in the URL (?branch=<id>); pages that list per-branch data read it.
 */
function BranchFilter() {
  const { t } = useTranslation("common");
  const { branchId, setBranchId } = useBranchFilter();
  const organizations = useOrganizations();
  const branches = organizations.data ?? [];

  return (
    <Select value={branchId ?? ALL} onValueChange={(next) => setBranchId(next === ALL ? null : next)}>
      <SelectTrigger size="sm" className="w-56" aria-label={t("nav.branch")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("nav.allBranches")}</SelectItem>
        {/* Inactive branches only show when they're the current filter. */}
        {branches
          .filter((org) => org.isActive || org.id === branchId)
          .map((org) => (
            <SelectItem key={org.id} value={org.id}>
              {org.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

export function AdminLayout() {
  const { t } = useTranslation(["common", "app"]);
  const navigate = useNavigate();
  const { withBranch } = useBranchFilter();

  const nav: NavGroup[] = [
    {
      label: t("app:groups.operations"),
      items: [
        { to: withBranch("/"), label: t("nav.dashboard"), icon: LayoutGrid, end: true },
        { to: withBranch("/shipments"), label: t("nav.shipments"), icon: Package },
        { to: withBranch("/messages"), label: t("nav.chat"), icon: MessageSquare },
      ],
    },
    {
      label: t("app:groups.manage"),
      items: [
        { to: withBranch("/users"), label: t("nav.users"), icon: Users },
        { to: withBranch("/branches"), label: t("nav.branches"), icon: Building2 },
        { to: withBranch("/api-keys"), label: t("nav.apiKeys"), icon: KeyRound },
      ],
    },
  ];

  return (
    <AppShell
      brand={
        <Link to={withBranch("/")} className="focus-ring rounded-md" aria-label={t("brand.name")}>
          <Logo label={t("app:logoLabel")} />
        </Link>
      }
      nav={nav}
      user={MOCK_USER}
      profileHref={withBranch("/profile")}
      onSignOut={() => navigate("/login")}
      topbarStart={<BranchFilter />}
    >
      <Outlet />
    </AppShell>
  );
}
