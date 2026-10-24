import { useTranslation } from "react-i18next";

import { useStaffSession } from "@trans/api";
import { PageHeader } from "@trans/ui/blocks/page-header";

import { TeamCards } from "../features/overview/team-cards";

/**
 * /: the overview, the home page for every role. Each section and card shows
 * only for the roles that can load it. The shipments section (admin and
 * support) goes above the team row.
 */
export function OverviewPage() {
  const { t } = useTranslation(["common", "app"]);
  const { user } = useStaffSession();

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("nav.dashboard")} · ${t("brand.name")}`}</title>
      <PageHeader
        title={user ? t(`app:overview.greeting.${partOfDay(new Date())}`, { name: user.name }) : t("nav.dashboard")}
        description={t("app:overview.description")}
      />
      <TeamCards />
    </div>
  );
}

/** By the browser's clock; after midnight still counts as evening. */
function partOfDay(now: Date) {
  const hour = now.getHours();
  return hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "evening";
}
