import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useStaffAccess, type Permission } from "@trans/api";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { Button } from "@trans/ui/components/button";

import { useBranchFilter } from "../branches/use-branch-filter";

/**
 * For pages backed by admin-only endpoints (@RequireRole("admin"): staff
 * accounts, roles, API keys). Other roles see "no access" inside the shell
 * instead of a page whose every request would answer 403.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useStaffAccess();
  return isAdmin ? children : <NoAccess />;
}

/**
 * For pages whose endpoints need one permission, e.g. the shipments pages
 * ("shipments:read:all": admin and support). Other roles see "no access", as
 * with RequireAdmin.
 */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useStaffAccess();
  return can(permission) ? children : <NoAccess />;
}

/** In place of a page the signed-in role can't use. */
export function NoAccess() {
  const { t } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();
  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("app:noAccess.title")} · ${t("brand.name")}`}</title>
      <EmptyState
        icon={Lock}
        title={t("app:noAccess.title")}
        description={t("app:noAccess.body")}
        action={
          <Button variant="secondary" asChild>
            <Link to={withBranch("/")}>{t("empty.backHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}
