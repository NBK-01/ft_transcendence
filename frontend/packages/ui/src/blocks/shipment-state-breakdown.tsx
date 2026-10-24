import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { shipmentStateDotClass, type ShipmentState } from "@trans/ui/blocks/shipment-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@trans/ui/components/tooltip";
import { cn } from "@trans/ui/lib/utils";

export type ShipmentStateCount = {
  state: ShipmentState;
  count: number;
  /** Where the state's row links to, e.g. the shipments list filtered to it. */
  href?: string;
};

/**
 * How shipments split across states: one stacked bar in the states' dot
 * colours, then a legend with each state's count and share, in the same order.
 * The bar is for the eye (hover a segment for its numbers; states that share a
 * tone sit apart by a gap and their place). The legend says everything as
 * text, so nothing relies on colour, and it's what screen readers and the
 * keyboard use.
 */
export function ShipmentStateBreakdown({
  items,
  label,
  className,
}: {
  items: readonly ShipmentStateCount[];
  /** Names the legend list for screen readers. */
  label?: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation("common");
  const locale = `${i18n.resolvedLanguage ?? "en"}-u-nu-latn`;
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const shareOf = (count: number) => percent.format(total > 0 ? count / total : 0);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* 2px gaps of surface between segments; an empty bar is a plain track. */}
      <div
        aria-hidden="true"
        className={cn("flex h-3 gap-0.5 overflow-hidden rounded-sm", total === 0 && "bg-gray-alpha-200")}
      >
        {items
          .filter((item) => item.count > 0)
          .map((item) => (
            <Tooltip key={item.state}>
              <TooltipTrigger asChild>
                <span
                  className={cn("min-w-1 basis-0", shipmentStateDotClass(item.state))}
                  style={{ flexGrow: item.count }}
                />
              </TooltipTrigger>
              <TooltipContent>
                {t(`status.${item.state}`)} · <span className="tabular-nums">{number.format(item.count)}</span> ·{" "}
                <span className="tabular-nums">{shareOf(item.count)}</span>
              </TooltipContent>
            </Tooltip>
          ))}
      </div>

      <ul aria-label={label} className="-mx-2 flex flex-col">
        {items.map((item) => {
          const row = (
            <>
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", shipmentStateDotClass(item.state))} />
              <span
                className={cn("min-w-0 flex-1 truncate text-label-14", item.count > 0 ? "text-gray-1000" : "text-gray-900")}
              >
                {t(`status.${item.state}`)}
              </span>
              <span className="text-label-14 text-gray-1000 tabular-nums">{number.format(item.count)}</span>
              <span className="min-w-10 text-end text-label-13 text-gray-900 tabular-nums">{shareOf(item.count)}</span>
            </>
          );
          const rowClass = "flex items-center gap-2.5 rounded-md px-2 py-1.5";
          return (
            <li key={item.state}>
              {item.href ? (
                <Link
                  to={item.href}
                  className={cn(rowClass, "focus-ring transition-colors duration-150 hover:bg-gray-alpha-100")}
                >
                  {row}
                </Link>
              ) : (
                <div className={rowClass}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
