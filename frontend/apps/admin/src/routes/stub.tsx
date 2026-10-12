import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PlaceholderPage } from "@trans/ui/blocks/placeholder-page";

const TITLE_KEY = {
  dashboard: "nav.dashboard",
  shipments: "nav.shipments",
  messages: "nav.chat",
  users: "nav.users",
  branches: "nav.branches",
  apiKeys: "nav.apiKeys",
  profile: "nav.profile",
} as const;

/** Route stub for features that land in a later milestone. */
export function Stub({ page, icon }: { page: keyof typeof TITLE_KEY; icon: LucideIcon }) {
  const { t } = useTranslation(["common", "app"]);
  return <PlaceholderPage title={t(TITLE_KEY[page])} description={t(`app:pages.${page}`)} icon={icon} homeHref="/" />;
}
