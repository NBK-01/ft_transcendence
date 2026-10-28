import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { ConfirmDelete } from "@trans/ui/blocks/confirm-delete";
import { Button } from "@trans/ui/components/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@trans/ui/components/card";

import { useDeleteAccount } from "./api";

/**
 * DELETE /auth/account, behind type-to-confirm (the account's own email) —
 * genuinely permanent: the account, its shipments, messages and avatar are
 * gone, not just locked out. More consequential than deactivating, so it
 * gets the same stricter confirmation already used for admin's highest-
 * stakes deletes. Ends the session on success: the caller navigates away
 * rather than relying on RequireCustomer's next render, since this is a
 * one-way action.
 */
export function DeleteAccountCard({ email }: { email: string }) {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const deleteAccount = useDeleteAccount();

  return (
    <Card>
      <CardHeader className="pb-6">
        <CardTitle>{t("profile.deleteAccountTitle")}</CardTitle>
        <CardDescription>{t("profile.deleteAccountDescription")}</CardDescription>
      </CardHeader>
      <CardFooter className="justify-end">
        <ConfirmDelete
          trigger={
            <Button variant="error" size="sm" prefix={<Trash2 />}>
              {t("profile.deleteAccount")}
            </Button>
          }
          title={t("profile.deleteAccountConfirmTitle")}
          description={t("profile.deleteAccountConfirmBody")}
          confirmText={email}
          actionLabel={t("profile.deleteAccount")}
          errorText={t("profile.deleteAccountError")}
          onConfirm={async () => {
            await deleteAccount.mutateAsync();
            void navigate("/login", { replace: true });
          }}
        />
      </CardFooter>
    </Card>
  );
}
