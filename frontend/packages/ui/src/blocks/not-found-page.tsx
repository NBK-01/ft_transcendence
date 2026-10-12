import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { LogoMark } from "@trans/ui/blocks/logo";
import { SiteFooter } from "@trans/ui/blocks/site-footer";
import { Button } from "@trans/ui/components/button";

export function NotFoundPage({ homeHref = "/" }: { homeHref?: string }) {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-dvh flex-col bg-background-100">
      <title>{`${t("notFound.title")} · ${t("brand.name")}`}</title>
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <LogoMark className="size-10" />
        <p className="text-label-mono-13 text-gray-900">404</p>
        <div className="flex max-w-sm flex-col gap-2">
          <h1 className="text-heading-32 text-balance">{t("notFound.title")}</h1>
          <p className="text-copy-16 text-pretty text-gray-900">{t("notFound.body")}</p>
        </div>
        <Button asChild>
          <Link to={homeHref}>{t("notFound.action")}</Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  );
}
