import { useTranslation } from "react-i18next";

import { ROLE_PERMISSIONS, type StaffRole } from "@trans/api";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Badge } from "@trans/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@trans/ui/components/card";
import { Skeleton } from "@trans/ui/components/skeleton";

import { useRoles } from "../features/users/api";

const ROLE_NAMES = Object.keys(ROLE_PERMISSIONS) as StaffRole[];

/**
 * /roles: every role and what it can do. Permissions come from the frontend's
 * own copy of the backend's RBAC matrix (@trans/api's ROLE_PERMISSIONS) —
 * there's no live per-role permissions endpoint, by design (see that file's
 * comment). Role descriptions come from GET /access-control/roles.
 */
export function RolesPage() {
  const { t } = useTranslation(["common", "app"]);
  const roles = useRoles();
  const descriptionOf = (name: string) => roles.data?.find((role) => role.name === name)?.description;

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("nav.roles")} · ${t("brand.name")}`}</title>
      <PageHeader title={t("nav.roles")} description={t("app:pages.roles")} />
      <div className="grid gap-4 sm:grid-cols-2">
        {ROLE_NAMES.map((name) => (
          <Card key={name}>
            <CardHeader>
              <CardTitle>{t(`app:users.roles.${name}`)}</CardTitle>
              <CardDescription>
                {roles.isPending ? <Skeleton className="h-4 w-48 max-w-full" /> : descriptionOf(name)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {ROLE_PERMISSIONS[name].map((permission) => (
                <Badge key={permission} variant="outline" className="font-mono">
                  {permission}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
