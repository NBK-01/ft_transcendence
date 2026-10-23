import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useStaffSession, type StaffUser } from "@trans/api";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Avatar } from "@trans/ui/components/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@trans/ui/components/card";

import { ChangePasswordCard } from "../features/profile/change-password-card";
import { SignOutEverywhereCard } from "../features/profile/sign-out-everywhere-card";

/** /profile: the signed-in staff member's account, password and sessions. */
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
        <AccountCard user={user} />
        <ChangePasswordCard email={user.email} />
        <SignOutEverywhereCard />
      </div>
    </div>
  );
}

/**
 * From the login response: there's no staff /me yet, so changes an admin makes
 * show after the next sign-in, and the branch isn't known.
 */
function AccountCard({ user }: { user: StaffUser }) {
  const { t } = useTranslation("app");
  const role = user.roleName ?? "none";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.accountTitle")}</CardTitle>
        <CardDescription>{t("profile.accountDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* The name is right next to it. */}
        <Avatar name={user.name} size="lg" aria-hidden="true" />
        <dl className="grid min-w-0 flex-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          <Row label={t("profile.name")} value={user.name} />
          <Row label={t("profile.email")} value={<span dir="ltr">{user.email}</span>} />
          <Row label={t("profile.role")} value={t(`users.roles.${role}`, { defaultValue: role })} />
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-label-12 text-gray-900">{label}</dt>
      <dd className="truncate text-copy-14 text-gray-1000">{value}</dd>
    </div>
  );
}
