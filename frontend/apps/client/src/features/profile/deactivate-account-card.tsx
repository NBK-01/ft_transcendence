import { UserX } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { ConfirmDelete } from "@trans/ui/blocks/confirm-delete";
import { Button } from "@trans/ui/components/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@trans/ui/components/card";

import { useDeactivateAccount } from "./api";

/**
 * POST /auth/account/deactivate, behind type-to-confirm (the account's own
 * email) — blocks sign-in and ends every session, but the row (and their
 * shipment/message history) stays; only support can reactivate it. Ends the
 * session on success: the caller navigates away rather than relying on
 * RequireCustomer's next render, since this isn't something to undo from here.
 */
export function DeactivateAccountCard({ email }: { email: string }) {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const deactivateAccount = useDeactivateAccount();

  return (
    <Card>
      <CardHeader className="pb-6">
        <CardTitle>{t("profile.deactivateAccountTitle")}</CardTitle>
        <CardDescription>{t("profile.deactivateAccountDescription")}</CardDescription>
      </CardHeader>
      <CardFooter className="justify-end">
        <ConfirmDelete
          trigger={
            <Button variant="error" size="sm" prefix={<UserX />}>
              {t("profile.deactivateAccount")}
            </Button>
          }
          title={t("profile.deactivateAccountConfirmTitle")}
          description={t("profile.deactivateAccountConfirmBody")}
          confirmText={email}
          actionLabel={t("profile.deactivateAccount")}
          errorText={t("profile.deactivateAccountError")}
          onConfirm={async () => {
            await deactivateAccount.mutateAsync();
            void navigate("/login", { replace: true });
          }}
        />
      </CardFooter>
    </Card>
  );
}
