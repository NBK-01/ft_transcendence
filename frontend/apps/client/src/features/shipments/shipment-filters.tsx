import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ORDER_STAGES, ShipmentStateDot, type ShipmentState } from "@trans/ui/blocks/shipment-state";
import { SHIPMENT_STATUSES } from "@trans/ui/blocks/status";
import { Input } from "@trans/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@trans/ui/components/select";

import { useShipmentFilters } from "./use-shipment-filters";

/** Radix Select can't use "" as a value, so "all" stands for "no status filter". */
const ALL = "all";
const SEARCH_DELAY_MS = 300;
/** "requested" is replaced by pending_sourcing in the order flow, so it isn't offered. */
const TRACKING_STATUSES = SHIPMENT_STATUSES.filter((status) => status !== "requested");

export function ShipmentFilters() {
  const { t } = useTranslation(["common", "app"]);
  const { q, status, update } = useShipmentFilters();

  // The input keeps its own text so typing is instant; the URL follows after a pause.
  const [draft, setDraft] = useState(q);

  // URL changed from outside (Back button, "Clear filters", a shared link): reflect it.
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    if (draft.trim() !== q) setDraft(q);
  }

  useEffect(() => {
    if (draft.trim() === q) return;
    const timer = setTimeout(() => update({ q: draft }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, q, update]);

  return (
    <div role="search" className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-900"
        />
        <Input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("app:shipments.searchPlaceholder")}
          aria-label={t("app:shipments.searchLabel")}
          autoComplete="off"
          spellCheck={false}
          className="ps-9 font-mono"
        />
      </div>

      <Select
        value={status ?? ALL}
        onValueChange={(value) => update({ status: value === ALL ? null : (value as ShipmentState) })}
      >
        <SelectTrigger aria-label={t("app:shipments.statusLabel")} className="sm:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("app:shipments.allStatuses")}</SelectItem>
          <SelectGroup>
            <SelectLabel>{t("app:shipments.filterGroups.order")}</SelectLabel>
            {ORDER_STAGES.map((value) => (
              <StateOption key={value} value={value} />
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>{t("app:shipments.filterGroups.tracking")}</SelectLabel>
            {TRACKING_STATUSES.map((value) => (
              <StateOption key={value} value={value} />
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function StateOption({ value }: { value: ShipmentState }) {
  const { t } = useTranslation("common");
  return (
    <SelectItem value={value}>
      <span className="flex items-center gap-2">
        <ShipmentStateDot status={value} />
        {t(`status.${value}`)}
      </span>
    </SelectItem>
  );
}
