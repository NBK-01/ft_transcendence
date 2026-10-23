import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@trans/ui/components/card";

import { countryName, formatMoney, formatWeight } from "./format";
import { ImageGrid } from "./image-grid";
import type { Address, ShipmentDetail } from "./types";

/**
 * Details tab, top to bottom as the order fills in: what the client asked for,
 * the agreed order once paid, then addresses, weight and value once it's live.
 * Uses the already-loaded shipment; no extra request.
 */
export function ShipmentDetails({ shipment }: { shipment: ShipmentDetail }) {
  const { t, i18n } = useTranslation("app");
  const { request, offer, payment, sender, recipient, weightKg, declaredValue } = shipment;
  const lang = i18n.language;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Section title={t("shipments.details.request")}>
        {request.productUrl && (
          <a
            href={request.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex max-w-full items-center gap-1.5 rounded-sm text-copy-14 text-blue-900 hover:underline"
            dir="ltr"
          >
            <span className="truncate">{request.productUrl}</span>
            <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
          </a>
        )}
        <ImageGrid images={request.images} />
      </Section>

      {offer && payment && (
        <Section title={t("shipments.details.order")}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Item label={t("shipments.details.supplier")} value={offer.supplierName} />
            <Item label={t("shipments.checkout.quantity")} value={String(payment.quantity)} />
            <Item label={t("shipments.checkout.total")} value={formatMoney(payment.total.amount, payment.total.currency, lang)} />
            <Item label={t("shipments.details.card")} value={`•••• ${payment.cardLast4}`} ltr />
          </dl>
        </Section>
      )}

      {sender && recipient && weightKg !== null && declaredValue ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <AddressCard title={t("shipments.details.from")} address={sender} />
            <AddressCard title={t("shipments.details.to")} address={recipient} />
          </div>
          <Card>
            <dl className="grid grid-cols-2 divide-x divide-gray-alpha-400 rtl:divide-x-reverse">
              <div className="flex flex-col gap-1 px-5 py-4">
                <dt className="text-label-12 text-gray-900">{t("shipments.details.weight")}</dt>
                <dd className="text-label-16 text-gray-1000 tabular-nums">{formatWeight(weightKg, lang)}</dd>
              </div>
              <div className="flex flex-col gap-1 px-5 py-4">
                <dt className="text-label-12 text-gray-900">{t("shipments.details.declaredValue")}</dt>
                <dd className="text-label-16 text-gray-1000 tabular-nums">
                  {formatMoney(declaredValue.amount, declaredValue.currency, lang)}
                </dd>
              </div>
            </dl>
          </Card>
        </>
      ) : (
        <p className="text-copy-14 text-gray-900">{t("shipments.details.notLiveYet")}</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="gap-3 px-5 py-4">
      <h3 className="text-label-12 text-gray-900">{title}</h3>
      {children}
    </Card>
  );
}

function Item({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-label-12 text-gray-900">{label}</dt>
      <dd className="truncate text-label-14 text-gray-1000 tabular-nums" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
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
