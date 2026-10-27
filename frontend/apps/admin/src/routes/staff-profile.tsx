import { ArrowLeft, Mail, MessageSquare, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router";

import {
  isApiError,
  STAFF_NOT_CONNECTED,
  useOpenStaffConversation,
  useStaffProfile,
  useStaffSession,
  type StaffProfile,
} from "@trans/api";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { Avatar } from "@trans/ui/components/avatar";
import { Badge } from "@trans/ui/components/badge";
import { Button } from "@trans/ui/components/button";
import { Card, CardContent } from "@trans/ui/components/card";
import { Skeleton } from "@trans/ui/components/skeleton";
import { toast } from "@trans/ui/components/toaster";
import { cn } from "@trans/ui/lib/utils";

import { useBranchFilter } from "../features/branches/use-branch-filter";
import { otherParty, useContacts } from "../features/contacts/api";
import { Row } from "../features/profile/account-card";

/** /profile/:id: a colleague's page, open to every staff member. Your own id goes to /profile. */
export function StaffProfilePage() {
  const { id = "" } = useParams();
  const { t } = useTranslation(["common", "app"]);
  const { user } = useStaffSession();
  const { withBranch } = useBranchFilter();
  const self = id === user?.id;
  const profile = useStaffProfile(self ? "" : id);

  if (self) return <Navigate to={withBranch("/profile")} replace />;
  if (profile.isPending) return <ProfileSkeleton />;
  if (profile.isError) {
    // Not a UUID is a 400: the same dead link to the reader.
    const notFound = isApiError(profile.error) && (profile.error.status === 404 || profile.error.status === 400);
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <EmptyState
          icon={UserRound}
          title={notFound ? t("app:staffProfile.notFoundTitle") : t("app:staffProfile.errorTitle")}
          description={notFound ? t("app:staffProfile.notFoundBody") : t("table.errorBody")}
          action={
            notFound ? undefined : (
              <Button variant="secondary" onClick={() => void profile.refetch()}>
                {t("table.retry")}
              </Button>
            )
          }
        />
      </div>
    );
  }
  return <Colleague profile={profile.data} />;
}

function Colleague({ profile }: { profile: StaffProfile }) {
  const { t, i18n } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();
  const role = profile.roleName ?? "none";
  const since = new Intl.DateTimeFormat(`${i18n.language}-u-nu-latn`, { dateStyle: "long" }).format(
    new Date(profile.createdAt),
  );

  return (
    <div className="flex flex-col gap-8">
      <title>{`${profile.name} · ${t("brand.name")}`}</title>
      <BackLink />
      <header className="flex flex-col gap-5 border-b border-gray-alpha-400 pb-6 sm:flex-row sm:items-center">
        {/* The name and the status are written out beside it. */}
        <div aria-hidden="true" className="flex">
          <Avatar
            name={profile.name}
            src={profile.avatarUrl}
            size="xl"
            className="size-24 text-heading-24"
            online={profile.online ?? undefined}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="truncate text-heading-32">{profile.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" size="sm">
              {t(`app:users.roles.${role}`, { defaultValue: role })}
            </Badge>
            {!profile.isActive && (
              <Badge variant="gray" size="sm">
                {t("app:users.status.deactivated")}
              </Badge>
            )}
            {/* Only their contacts know; null for anyone else. */}
            {profile.online !== null && (
              <span className="flex items-center gap-1.5 text-label-13 text-gray-900">
                <span
                  aria-hidden="true"
                  className={cn("size-2 rounded-full", profile.online ? "bg-green-700" : "bg-gray-600")}
                />
                {t(profile.online ? "presence.online" : "presence.offline")}
              </span>
            )}
          </div>
        </div>
        <MessageButton profile={profile} />
      </header>

      <Card className="max-w-2xl">
        <CardContent>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Row
              label={t("app:profile.email")}
              value={
                <a
                  href={`mailto:${profile.email}`}
                  dir="ltr"
                  className="focus-ring inline-flex items-center gap-1.5 rounded-sm hover:underline"
                >
                  <Mail className="size-4 shrink-0 text-gray-900" aria-hidden="true" />
                  {profile.email}
                </a>
              }
            />
            <Row
              label={t("app:profile.branch")}
              value={
                profile.organization ? (
                  <Link
                    to={withBranch(`/branches/${encodeURIComponent(profile.organization.id)}`)}
                    className="focus-ring rounded-sm hover:underline"
                  >
                    {profile.organization.name}
                  </Link>
                ) : (
                  t("app:users.noBranch")
                )
              }
            />
            <Row label={t("app:staffProfile.memberSince")} value={since} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

/** "Message": for accepted contacts only, like the Contacts page (chat needs it). */
function MessageButton({ profile }: { profile: StaffProfile }) {
  const { t } = useTranslation("app");
  const { user } = useStaffSession();
  const contacts = useContacts();
  const { withBranch } = useBranchFilter();
  const navigate = useNavigate();
  const open = useOpenStaffConversation();
  const myId = user?.id ?? "";
  const connected = (contacts.data ?? []).some(
    (contact) => contact.status === "accepted" && otherParty(contact, myId).id === profile.id,
  );
  if (!connected) return null;

  const message = async () => {
    try {
      const conversation = await open.mutateAsync(profile.id);
      void navigate(withBranch(`/messages/${conversation.id}`));
    } catch (error) {
      const gone = isApiError(error) && error.errorCode === STAFF_NOT_CONNECTED;
      toast.error(t(gone ? "messages.notConnected" : "messages.openError"));
    }
  };

  return (
    <Button prefix={<MessageSquare />} loading={open.isPending} onClick={() => void message()} className="w-fit">
      {t("messages.message")}
    </Button>
  );
}

/** People come here from Contacts and Messages; Contacts is the way back that always makes sense. */
function BackLink() {
  const { t } = useTranslation("common");
  const { withBranch } = useBranchFilter();
  return (
    <Link
      to={withBranch("/contacts")}
      className="focus-ring flex w-fit items-center gap-1.5 rounded-md text-label-14 text-gray-900 hover:text-gray-1000"
    >
      <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
      {t("nav.contacts")}
    </Link>
  );
}

function ProfileSkeleton() {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <span className="sr-only">{t("table.loading")}</span>
      <Skeleton className="h-5 w-28" />
      <div className="flex items-center gap-5">
        <Skeleton className="size-24 rounded-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
      <Skeleton className="h-32 w-full max-w-2xl" />
    </div>
  );
}
