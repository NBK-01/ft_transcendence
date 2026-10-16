import { useTranslation } from "react-i18next";

import { Card } from "@trans/ui/components/card";

import { countryName, formatMoney, formatWeight } from "./format";
import type { Address, ShipmentDetail } from "./types";

/** Details tab: who it's from, who it's for, and what's inside. Uses the already-loaded shipment. */
export function ShipmentDetails({ shipment }: { shipment: ShipmentDetail }) {
  const { t, i18n } = useTranslation("app");
  const { weightKg, declaredValue } = shipment;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <AddressCard title={t("shipments.details.from")} address={shipment.sender} />
        <AddressCard title={t("shipments.details.to")} address={shipment.recipient} />
      </div>

      <Card>
        <dl className="grid grid-cols-2 divide-x divide-gray-alpha-400 rtl:divide-x-reverse">
          <div className="flex flex-col gap-1 px-5 py-4">
            <dt className="text-label-12 text-gray-900">{t("shipments.details.weight")}</dt>
            <dd className="text-label-16 text-gray-1000 tabular-nums">{formatWeight(weightKg, i18n.language)}</dd>
          </div>
          <div className="flex flex-col gap-1 px-5 py-4">
            <dt className="text-label-12 text-gray-900">{t("shipments.details.declaredValue")}</dt>
            <dd className="text-label-16 text-gray-1000 tabular-nums">
              {formatMoney(declaredValue.amount, declaredValue.currency, i18n.language)}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

function AddressCard({ title, address }: { title: string; address: Address }) {
  const { i18n } = useTranslation();
  return (
    <Card className="gap-2 px-5 py-4">
      <h3 className="text-label-12 text-gray-900">{title}</h3>
      <address className="flex flex-col gap-0.5 text-copy-14 text-gray-1000 not-italic">
        <span className="font-medium">{address.name}</span>
        <span>{address.street}</span>
        <span>{[address.postalCode, address.city].filter(Boolean).join(" ")}</span>
        <span>{countryName(address.country, i18n.language)}</span>
        {address.phone && (
          <span className="pt-1 text-gray-900 tabular-nums" dir="ltr">
            {address.phone}
          </span>
        )}
      </address>
    </Card>
  );
}
