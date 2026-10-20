import { Building2, KeyRound, LayoutGrid, MessageSquare, Package, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";

import { useStaffAccess, useStaffLogout, useStaffSession } from "@trans/api";
import { AppShell, type NavGroup } from "@trans/ui/blocks/app-shell";
import { Logo } from "@trans/ui/blocks/logo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trans/ui/components/select";

import { useOrganizations } from "../features/branches/api";
import { useBranchFilter } from "../features/branches/use-branch-filter";

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

/** The signed-in shell. Rendered inside RequireStaff, so there's always a staff session here. */
export function AdminLayout() {
  const { t } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();
  const { user } = useStaffSession();
  const { isAdmin } = useStaffAccess();
  const signOut = useStaffLogout();

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
      // Staff accounts and API keys are admin-only; every role can read the branches.
      items: [
        ...(isAdmin ? [{ to: withBranch("/users"), label: t("nav.users"), icon: Users }] : []),
        { to: withBranch("/branches"), label: t("nav.branches"), icon: Building2 },
        ...(isAdmin ? [{ to: withBranch("/api-keys"), label: t("nav.apiKeys"), icon: KeyRound }] : []),
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
      user={{
        name: user?.name ?? "",
        email: user?.email ?? "",
        role: user?.roleName ? t(`app:users.roles.${user.roleName}`, { defaultValue: user.roleName }) : undefined,
      }}
      profileHref={withBranch("/profile")}
      // RequireStaff takes it from here: it shows /login once the session is gone.
      onSignOut={signOut}
      topbarStart={<BranchFilter />}
    >
      <Outlet />
    </AppShell>
  );
}
