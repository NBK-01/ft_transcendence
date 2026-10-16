import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@trans/ui/components/badge";
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
  icon?: LucideIcon;
  isLoading?: boolean;
  className?: string;
};

/** A label, one big number in tabular figures, and the change since last period. */
export function StatCard({
  label,
  value,
  format,
  change,
  changeLabel,
  positiveIsGood = true,
  icon: Icon,
  isLoading = false,
  className,
}: StatCardProps) {
  const { t, i18n } = useTranslation("common");
  const locale = numberLocale(i18n.resolvedLanguage ?? "en");

  const formatted = typeof value === "number" ? new Intl.NumberFormat(locale, format).format(value) : value;

  return (
    <Card className={cn("gap-3 p-5", className)} aria-busy={isLoading || undefined}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-label-14 text-gray-900">{label}</p>
        {Icon && <Icon className="size-4 shrink-0 text-gray-700" aria-hidden="true" />}
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-10 w-28" />
          {change !== undefined && <Skeleton className="h-5 w-36" />}
        </>
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
