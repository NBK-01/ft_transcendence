import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Button } from "@trans/ui/components/button";

/** Route stub inside the app shell: real header + an empty state until the feature lands. */
export function PlaceholderPage({
  title,
  description,
  icon,
  homeHref = "/",
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  homeHref?: string;
}) {
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-col gap-8">
      <title>{`${title} · ${t("brand.name")}`}</title>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title={t("empty.comingSoonTitle")}
        description={t("empty.comingSoonBody")}
        action={
          <Button variant="secondary" asChild>
            <Link to={homeHref}>{t("empty.backHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}
