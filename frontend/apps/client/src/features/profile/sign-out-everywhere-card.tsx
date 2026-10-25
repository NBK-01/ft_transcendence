import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useLogoutEverywhere } from "@trans/api";
import { ConfirmDelete } from "@trans/ui/blocks/confirm-delete";
import { Button } from "@trans/ui/components/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@trans/ui/components/card";

/**
 * POST /auth/logout-all, behind a confirmation. On success this device is
 * signed out too, so RequireCustomer shows the login page. On failure the
 * dialog stays open with its error: the other devices are still signed in.
 */
export function SignOutEverywhereCard() {
  const { t } = useTranslation("app");
  const logoutEverywhere = useLogoutEverywhere();

  return (
    <Card>
      <CardHeader className="pb-6">
        <CardTitle>{t("profile.sessionsTitle")}</CardTitle>
        <CardDescription>{t("profile.sessionsDescription")}</CardDescription>
      </CardHeader>
      <CardFooter className="justify-end">
        <ConfirmDelete
          trigger={
            <Button variant="secondary" size="sm" prefix={<LogOut className="rtl:-scale-x-100" />}>
              {t("profile.signOutEverywhere")}
            </Button>
          }
          title={t("profile.signOutEverywhereTitle")}
          description={t("profile.signOutEverywhereBody")}
          actionLabel={t("profile.signOutEverywhere")}
          errorText={t("profile.signOutEverywhereError")}
          onConfirm={() => logoutEverywhere.mutateAsync()}
        />
      </CardFooter>
    </Card>
  );
}
