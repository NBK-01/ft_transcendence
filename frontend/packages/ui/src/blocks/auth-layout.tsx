import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { LanguageSwitcher } from "@trans/ui/blocks/language-switcher";
import { Logo } from "@trans/ui/blocks/logo";
import { StatusDot } from "@trans/ui/blocks/status";
import { ThemeSwitcher } from "@trans/ui/blocks/theme-switcher";
import { TimelineList, type TimelineEvent } from "@trans/ui/blocks/timeline";
import { Badge } from "@trans/ui/components/badge";
import { cn } from "@trans/ui/lib/utils";

const legalLinkClasses =
  "focus-ring rounded-sm text-label-13 text-gray-900 underline-offset-4 transition-colors duration-150 hover:text-gray-1000 hover:underline";

/**
 * Sign-in / sign-up / 2FA frame. The form column is deliberately narrow
 * (Vercel login); on large screens a side panel previews the product:
 * a live tracking timeline.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  logoLabel,
  showPanel = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Below the form, e.g. "Don't have an account? Sign up". */
  footer?: ReactNode;
  /** Suffix on the logo, e.g. "Admin". */
  logoLabel?: string;
  showPanel?: boolean;
}) {
  const { t } = useTranslation("common");

  return (
    <div className={cn("grid min-h-dvh bg-background-100", showPanel && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="focus-ring rounded-md" aria-label={t("brand.name")}>
            <Logo label={logoLabel} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </header>

        <main id="main" className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="flex w-full max-w-sm flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-heading-32 text-balance">{title}</h1>
              {subtitle && <p className="text-copy-16 text-pretty text-gray-900">{subtitle}</p>}
            </div>
            {children}
            {footer && <div className="text-copy-14 text-gray-900">{footer}</div>}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
          <p className="text-label-12 text-gray-900">{t("footer.rights", { year: new Date().getFullYear() })}</p>
          <nav aria-label={t("footer.legal")} className="flex items-center gap-5">
            <Link to="/privacy" className={legalLinkClasses}>
              {t("footer.privacy")}
            </Link>
            <Link to="/terms" className={legalLinkClasses}>
              {t("footer.terms")}
            </Link>
          </nav>
        </footer>
      </div>

      {showPanel && <TrackingPanel />}
    </div>
  );
}

/**
 * No time zone (local time), so the preview reads 09:42 everywhere. Places are
 * keys under `auth.panelPlaces`, so the preview reads in the page's language.
 */
const DEMO_EVENTS = [
  { status: "out_for_delivery", place: "paris", occurredAt: "2026-10-16T09:42:00" },
  { status: "in_transit", place: "lyonHub", occurredAt: "2026-10-16T04:10:00" },
  { status: "in_transit", place: "casablancaHub", occurredAt: "2026-10-15T22:18:00" },
  { status: "confirmed", place: "casablanca", occurredAt: "2026-10-15T16:05:00" },
] as const;
const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };

/** Decorative product preview (aria-hidden): a shipment moving, rendered with real components. */
function TrackingPanel() {
  const { t } = useTranslation("common");
  const events: TimelineEvent[] = DEMO_EVENTS.map(({ place, ...event }) => ({
    ...event,
    location: t(`auth.panelPlaces.${place}`),
  }));

  return (
    <aside
      aria-hidden="true"
      className={cn(
        "relative hidden flex-col justify-center gap-10 overflow-hidden border-s border-gray-alpha-400 bg-background-200 p-12 lg:flex xl:p-20",
        "bg-[radial-gradient(var(--gray-alpha-400)_1px,transparent_1px)] bg-size-[20px_20px]",
      )}
    >
      <div className="flex max-w-md flex-col gap-3">
        <h2 className="text-heading-40 text-balance">{t("auth.panelTitle")}</h2>
        <p className="text-copy-18 text-pretty text-gray-900">{t("auth.panelBody")}</p>
      </div>

      <div className="w-full max-w-md rounded-xl border border-gray-alpha-400 bg-background-100 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-alpha-400 px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-label-12 text-gray-900">{t("auth.panelTracking")}</span>
            <span className="text-label-mono-14 text-gray-1000" dir="ltr">
              ST-7K2Q-94A1
            </span>
          </div>
          <Badge variant="outline" size="sm" className="gap-1.5">
            <StatusDot status="out_for_delivery" />
            {t("auth.panelLive")}
          </Badge>
        </div>

        <div className="flex items-center gap-3 border-b border-gray-alpha-400 px-5 py-3 text-label-mono-12 text-gray-900" dir="ltr">
          <span>CMN</span>
          <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,var(--gray-alpha-600)_0_4px,transparent_4px_8px)]" />
          <span className="size-1.5 rounded-full bg-orange-700" />
          <span className="h-px w-10 bg-gray-alpha-400" />
          <span>CDG</span>
        </div>

        <TimelineList events={events} format={TIME_ONLY} />
      </div>
    </aside>
  );
}
