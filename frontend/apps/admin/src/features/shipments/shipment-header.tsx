import { useTranslation } from "react-i18next";

import type { AdminShipmentDetail } from "@trans/api";
import { ShipmentStateBadge } from "@trans/ui/blocks/shipment-state";
import { CopyButton } from "@trans/ui/components/copy-button";

import { DetailItem } from "./detail-parts";
import { useDetailFormat } from "./use-detail-format";

/**
 * The shared PageHeader's frame, but the title is the tracking ID in mono with
 * a copy button and the status, and under it who ordered it and when.
 */
export function ShipmentHeader({ shipment }: { shipment: AdminShipmentDetail }) {
  const { t } = useTranslation("app");
  const format = useDetailFormat();
  const { trackingId, client, createdAt, updatedAt } = shipment;

  return (
    <header className="flex flex-col gap-5 border-b border-gray-alpha-400 pb-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-1">
          <h1 className="truncate font-mono text-heading-32">{trackingId}</h1>
          <CopyButton value={trackingId} label={t("shipment.copyTrackingId")} />
        </div>
        <ShipmentStateBadge status={shipment.status} size="lg" />
      </div>
      <dl className="flex flex-wrap gap-x-10 gap-y-4">
        <DetailItem label={t("shipment.customer")}>
          <span className="block truncate">
            <bdi>{client.name}</bdi>
          </span>
          <span className="block truncate">
            <a
              href={`mailto:${client.email}`}
              dir="ltr"
              className="focus-ring rounded-sm text-gray-900 hover:text-gray-1000 hover:underline"
            >
              {client.email}
            </a>
          </span>
        </DetailItem>
        <DetailItem label={t("shipment.created")}>
          <time dateTime={createdAt}>{format.dateTime(createdAt)}</time>
        </DetailItem>
        <DetailItem label={t("shipment.updated")}>
          <time dateTime={updatedAt}>{format.dateTime(updatedAt)}</time>
        </DetailItem>
      </dl>
    </header>
  );
}
