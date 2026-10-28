import { Pencil, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Button } from "@trans/ui/components/button";
import { Card } from "@trans/ui/components/card";
import { Skeleton } from "@trans/ui/components/skeleton";

import { useProfile } from "../features/profile/api";
import { AvatarSection } from "../features/profile/avatar-section";
import { ChangePasswordCard } from "../features/profile/change-password-card";
import { DeactivateAccountCard } from "../features/profile/deactivate-account-card";
import { DeleteAccountCard } from "../features/profile/delete-account-card";
import { ProfileDetails } from "../features/profile/profile-details";
import { ProfileForm } from "../features/profile/profile-form";
import { SignOutEverywhereCard } from "../features/profile/sign-out-everywhere-card";

/** /app/profile — photo and personal details; "Edit profile" switches the details to a form. */
export function ProfilePage() {
  const { t } = useTranslation(["common", "app"]);
  const { data: profile, isPending, isError, refetch, isFetching } = useProfile();
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("nav.profile")} · ${t("brand.name")}`}</title>
      <PageHeader
        title={t("nav.profile")}
        description={t("app:pages.profile")}
        actions={
          profile &&
          !editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              {t("app:profile.edit")}
            </Button>
          )
        }
      />

      {isPending ? (
        <ProfileSkeleton />
      ) : isError ? (
        <EmptyState
          icon={TriangleAlert}
          title={t("app:profile.errors.loadTitle")}
          description={t("app:profile.errors.loadBody")}
          action={
            <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
              {t("app:profile.retry")}
            </Button>
          }
        />
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          <Card className="gap-8 px-6 py-6">
            <AvatarSection name={profile.name} avatarUrl={profile.avatarUrl} />
            <div className="border-t border-gray-alpha-400 pt-6">
              {editing ? (
                <ProfileForm profile={profile} onDone={() => setEditing(false)} />
              ) : (
                <ProfileDetails profile={profile} />
              )}
            </div>
          </Card>
          <ChangePasswordCard email={profile.email} />
          <SignOutEverywhereCard />
          <DeactivateAccountCard email={profile.email} />
          <DeleteAccountCard email={profile.email} />
        </div>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <Card aria-busy="true" className="max-w-3xl gap-8 px-6 py-6">
      <div className="flex items-center gap-5">
        <Skeleton className="size-24 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="grid gap-x-8 gap-y-5 border-t border-gray-alpha-400 pt-6 sm:grid-cols-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </Card>
  );
}
