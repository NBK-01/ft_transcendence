import { useTranslation } from "react-i18next";

import { LIVE_STATES, type Address, type AdminShipmentDetail } from "@trans/api";

import { DetailItem, DetailSection } from "./detail-parts";
import { formatMoney } from "./format";
import { ShipmentRoute } from "./shipment-route";
import { useDetailFormat } from "./use-detail-format";

/**
 * Route, weight, declared value and both addresses: set when the payment is
 * confirmed. Nothing before that, nor for a shipment cancelled before it.
 */
export function DeliverySection({ shipment }: { shipment: AdminShipmentDetail }) {
  const { t, i18n } = useTranslation("app");
  const format = useDetailFormat();
  const { status, sender, recipient, weightKg, declaredValue } = shipment;
  if (!LIVE_STATES.includes(status) || !sender || !recipient) return null;

  return (
    <DetailSection title={t("shipment.delivery.title")}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <DetailItem label={t("shipment.delivery.route")} className="col-span-2 sm:col-span-1">
          <ShipmentRoute origin={shipment.origin} destination={shipment.destination} className="max-w-full" />
        </DetailItem>
        {weightKg !== null && (
          <DetailItem label={t("shipment.delivery.weight")}>
            <span className="tabular-nums">{format.weight(weightKg)}</span>
          </DetailItem>
        )}
        {declaredValue && (
          <DetailItem label={t("shipment.delivery.declaredValue")}>
            <span className="tabular-nums">{formatMoney(declaredValue, i18n.language)}</span>
          </DetailItem>
        )}
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        <AddressCard title={t("shipment.delivery.sender")} address={sender} />
        <AddressCard title={t("shipment.delivery.recipient")} address={recipient} />
      </div>
    </DetailSection>
  );
}

/** Typed by staff, in any language: each line is isolated, so its punctuation stays put in either direction. */
function AddressCard({ title, address }: { title: string; address: Address }) {
  const format = useDetailFormat();
  const { name, street, city, postalCode, country, phone } = address;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-gray-alpha-400 bg-background-200 px-4 py-3">
      <h3 className="text-label-12 text-gray-900">{title}</h3>
      <address className="flex flex-col gap-0.5 text-copy-14 text-gray-1000 not-italic">
        {/* <bdi> inside a block: the text keeps its own direction, the line keeps the page's alignment. */}
        <span className="font-medium">
          <bdi>{name}</bdi>
        </span>
        <span>
          <bdi>{street}</bdi>
        </span>
        <span>
          <bdi>{[postalCode, city].filter(Boolean).join(" ")}</bdi>
        </span>
        <span>{format.country(country)}</span>
        {phone && (
          <span className="pt-1">
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              dir="ltr"
              className="focus-ring rounded-sm text-gray-900 tabular-nums hover:text-gray-1000 hover:underline"
            >
              {phone}
            </a>
          </span>
        )}
      </address>
    </div>
  );
}
