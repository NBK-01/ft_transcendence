import { Package } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PlaceholderPage } from "@trans/ui/blocks/placeholder-page";

import { useBranchFilter } from "../features/branches/use-branch-filter";

/** /shipments: every client's shipments (needs "shipments:read:all"). A placeholder until the page is built. */
export function ShipmentsPage() {
  const { t } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();
  return (
    <PlaceholderPage
      title={t("nav.shipments")}
      description={t("app:pages.shipments")}
      icon={Package}
      homeHref={withBranch("/")}
    />
  );
}
