import { BadgeCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { namesOf, parseDateOnly } from "./names";
import type { Profile } from "./types";

/** View mode: the details as a description list. Missing values read "Not set". */
export function ProfileDetails({ profile }: { profile: Profile }) {
  const { t, i18n } = useTranslation("app");
  const { firstName, lastName } = namesOf(profile);
  const birthDate = profile.dateOfBirth
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(parseDateOnly(profile.dateOfBirth))
    : null;

  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      <Row label={t("profile.fields.firstName")} value={firstName} />
      <Row label={t("profile.fields.lastName")} value={lastName} />
      <Row
        label={t("profile.fields.email")}
        value={
          <span className="inline-flex items-center gap-1.5" dir="ltr">
            {profile.email}
            {profile.isVerified && (
              <BadgeCheck aria-label={t("profile.verified")} className="size-4 shrink-0 text-blue-700" />
            )}
          </span>
        }
      />
      <Row label={t("profile.fields.dateOfBirth")} value={birthDate} />
      <Row
        label={t("profile.fields.phoneNumber")}
        value={profile.phoneNumber && <span dir="ltr">{profile.phoneNumber}</span>}
      />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  const { t } = useTranslation("app");
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-label-12 text-gray-900">{label}</dt>
      <dd className="truncate text-copy-14 text-gray-1000">
        {value || <span className="text-gray-900">{t("profile.notSet")}</span>}
      </dd>
    </div>
  );
}
