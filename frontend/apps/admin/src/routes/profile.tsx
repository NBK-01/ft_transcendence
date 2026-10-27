import { useTranslation } from "react-i18next";

import { useStaffSession } from "@trans/api";
import { PageHeader } from "@trans/ui/blocks/page-header";

import { AccountCard } from "../features/profile/account-card";
import { ChangePasswordCard } from "../features/profile/change-password-card";
import { SignOutEverywhereCard } from "../features/profile/sign-out-everywhere-card";

/** /profile: the signed-in staff member's name and photo, password and sessions. */
export function ProfilePage() {
  const { t } = useTranslation(["common", "app"]);
  const { user } = useStaffSession();
  // RequireStaff only renders this page with a session.
  if (!user) return null;

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("nav.profile")} · ${t("brand.name")}`}</title>
      <PageHeader title={t("nav.profile")} description={t("app:pages.profile")} />
      <div className="flex max-w-2xl flex-col gap-6">
        <AccountCard />
        <ChangePasswordCard email={user.email} />
        <SignOutEverywhereCard />
      </div>
    </div>
  );
}
