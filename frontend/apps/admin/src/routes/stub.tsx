import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PlaceholderPage } from "@trans/ui/blocks/placeholder-page";

import { useBranchFilter } from "../features/branches/use-branch-filter";

const TITLE_KEY = {
  dashboard: "nav.dashboard",
  shipments: "nav.shipments",
  apiKeys: "nav.apiKeys",
} as const;

/** Route stub for features that land in a later milestone. */
export function Stub({ page, icon }: { page: keyof typeof TITLE_KEY; icon: LucideIcon }) {
  const { t } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();
  return (
    <PlaceholderPage
      title={t(TITLE_KEY[page])}
      description={t(`app:pages.${page}`)}
      icon={icon}
      homeHref={withBranch("/")}
    />
  );
}
