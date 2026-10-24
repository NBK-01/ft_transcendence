import { LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PlaceholderPage } from "@trans/ui/blocks/placeholder-page";

import { useBranchFilter } from "../features/branches/use-branch-filter";

/** /: the overview, for every role. A placeholder until the page is built. */
export function OverviewPage() {
  const { t } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();
  return (
    <PlaceholderPage
      title={t("nav.dashboard")}
      description={t("app:pages.dashboard")}
      icon={LayoutGrid}
      homeHref={withBranch("/")}
    />
  );
}
