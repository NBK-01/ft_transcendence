import { CircleAlert, Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@trans/ui/components/badge";
import { Button } from "@trans/ui/components/button";
import { Card } from "@trans/ui/components/card";
import { Skeleton } from "@trans/ui/components/skeleton";
import { cn } from "@trans/ui/lib/utils";

/** Western digits in every language, to match tracking IDs, weights and dates. */
function numberLocale(language: string) {
  return `${language}-u-nu-latn`;
}

export type StatCardProps = {
  label: string;
  /** Numbers are formatted for the current language; strings are shown as-is. */
  value?: number | string;
  format?: Intl.NumberFormatOptions;
  /** Change since the previous period as a fraction: 0.12 shows "+12%". */
  change?: number;
  /** Defaults to "vs previous period". */
  changeLabel?: string;
  /** Set to false when an increase is bad (e.g. cancellations), so it shows red. */
  positiveIsGood?: boolean;
  /** A short line under the number: what it covers (e.g. "In Amman Central") or a breakdown. */
  description?: ReactNode;
  icon?: LucideIcon;
  isLoading?: boolean;
  /** Set when the number couldn't load: the card says so, with a retry button if `onRetry` is given. */
  error?: unknown;
  onRetry?: () => void;
  className?: string;
};

/** A label, one big number in tabular figures, then the change since last period and/or a short description. */
export function StatCard({
  label,
  value,
  format,
  change,
  changeLabel,
  positiveIsGood = true,
  description,
  icon: Icon,
  isLoading = false,
  error,
  onRetry,
  className,
}: StatCardProps) {
  const { t, i18n } = useTranslation("common");
  const locale = numberLocale(i18n.resolvedLanguage ?? "en");
  const labelId = useId();

  const formatted = typeof value === "number" ? new Intl.NumberFormat(locale, format).format(value) : value;

  return (
    <Card className={cn("gap-3 p-5", className)} aria-busy={isLoading || undefined}>
      <div className="flex items-center justify-between gap-2">
        <p id={labelId} className="text-label-14 text-gray-900">
          {label}
        </p>
        {Icon && <Icon className="size-4 shrink-0 text-gray-700" aria-hidden="true" />}
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-10 w-28" />
          {change !== undefined && <Skeleton className="h-5 w-36" />}
          {description && <Skeleton className="h-5 w-32" />}
        </>
      ) : error ? (
        <div role="alert" className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2">
          <p className="flex items-center gap-1.5 text-copy-14 text-gray-900">
            <CircleAlert className="size-4 shrink-0 text-red-700" aria-hidden="true" />
            {t("stat.error")}
          </p>
          {onRetry && (
            // Several cards can fail at once: the label says which one this retries.
            <Button variant="secondary" size="sm" aria-describedby={labelId} onClick={onRetry}>
              {t("table.retry")}
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-heading-32 tabular-nums">{formatted ?? "—"}</p>
          {change !== undefined && (
            <ChangeBadge
              change={change}
              locale={locale}
              positiveIsGood={positiveIsGood}
              label={changeLabel ?? t("stat.vsPrevious")}
            />
          )}
          {description && <div className="text-copy-13 text-gray-900">{description}</div>}
        </>
      )}
    </Card>
  );
}

function ChangeBadge({
  change,
  locale,
  positiveIsGood,
  label,
}: {
  change: number;
  locale: string;
  positiveIsGood: boolean;
  label: string;
}) {
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(change);

  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const good = direction === "flat" ? null : (direction === "up") === positiveIsGood;
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-copy-13 text-gray-900">
      <Badge variant={good === null ? "gray" : good ? "green" : "red"} size="sm">
        {/* Trend arrows point along the reading direction, so they mirror in RTL. */}
        <Icon className="rtl:-scale-x-100" aria-hidden="true" />
        <span dir="ltr">{percent}</span>
      </Badge>
      <span>{label}</span>
    </p>
  );
}
