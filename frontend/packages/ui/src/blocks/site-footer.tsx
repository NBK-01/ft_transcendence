import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { LanguageSwitcher } from "@trans/ui/blocks/language-switcher";
import { LogoMark } from "@trans/ui/blocks/logo";
import { ThemeSwitcher } from "@trans/ui/blocks/theme-switcher";
import { cn } from "@trans/ui/lib/utils";

const linkClasses =
  "focus-ring rounded-sm text-label-13 text-gray-900 underline-offset-4 transition-colors duration-150 hover:text-gray-1000 hover:underline";

/**
 * Mandatory on every page: Privacy Policy + Terms of Service links.
 * Paths are relative to the app's router basename (so `/admin/privacy` in admin).
 */
export function SiteFooter({ className, showSwitchers = true }: { className?: string; showSwitchers?: boolean }) {
  const { t } = useTranslation("common");

  return (
    <footer className={cn("border-t border-gray-alpha-400", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between md:px-8">
        <div className="flex items-center gap-3">
          <LogoMark className="size-5" />
          <p className="text-label-13 text-pretty text-gray-900">
            {t("footer.rights", { year: new Date().getFullYear() })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <nav aria-label={t("footer.legal")} className="flex items-center gap-5">
            <Link to="/privacy" className={linkClasses}>
              {t("footer.privacy")}
            </Link>
            <Link to="/terms" className={linkClasses}>
              {t("footer.terms")}
            </Link>
          </nav>
          {showSwitchers && (
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <LanguageSwitcher />
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
