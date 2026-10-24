import { useTranslation } from "react-i18next";

import type { PaymentSummary, ShipmentRequest, SupplierOffer } from "@trans/api";

import { DetailItem, DetailSection, NewTabLink } from "./detail-parts";
import { formatMoney } from "./format";
import { PhotoGrid } from "./photo-grid";
import { useDetailFormat } from "./use-detail-format";

/** Only http(s) links are clickable. The backend checks this too, but a `javascript:` link must never reach an href. */
function webLink(url: string) {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** What the customer asked for: a product link or photos (the API takes one or the other). */
export function RequestSection({ request }: { request: ShipmentRequest }) {
  const { t } = useTranslation("app");
  const { productUrl, images } = request;
  const href = productUrl && webLink(productUrl);

  return (
    <DetailSection title={t("shipment.request.title")}>
      {productUrl || images.length > 0 ? (
        <dl className="flex flex-col gap-4">
          {productUrl && (
            <DetailItem label={t("shipment.request.productLink")}>
              {href ? (
                <NewTabLink href={href} dir="ltr">
                  {productUrl}
                </NewTabLink>
              ) : (
                <span dir="ltr" className="break-all">
                  {productUrl}
                </span>
              )}
            </DetailItem>
          )}
          {images.length > 0 && (
            <DetailItem label={t("shipment.request.photos")}>
              <PhotoGrid images={images} />
            </DetailItem>
          )}
        </dl>
      ) : (
        <p className="text-copy-14 text-gray-900">{t("shipment.request.empty")}</p>
      )}
    </DetailSection>
  );
}

/** The supplier offer the customer decides on: the newest one they haven't rejected. */
export function OfferSection({ offer }: { offer: SupplierOffer }) {
  const { t, i18n } = useTranslation("app");
  const format = useDetailFormat();

  return (
    <DetailSection title={t("shipment.offer.title")}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <DetailItem label={t("shipment.offer.supplier")} className="col-span-2 sm:col-span-1">
          {/* Typed by staff, in any language: isolated so its punctuation stays put in either direction. */}
          <bdi>{offer.supplierName}</bdi>
        </DetailItem>
        <DetailItem label={t("shipment.offer.unitPrice")}>
          <span className="tabular-nums">{formatMoney(offer.unitPrice, i18n.language)}</span>
        </DetailItem>
        <DetailItem label={t("shipment.offer.offeredAt")}>
          <time dateTime={offer.offeredAt}>{format.dateTime(offer.offeredAt)}</time>
        </DetailItem>
        {offer.note && (
          <DetailItem label={t("shipment.offer.note")} className="col-span-full">
            <p dir="auto" className="whitespace-pre-line">
              {offer.note}
            </p>
          </DetailItem>
        )}
        {offer.images.length > 0 && (
          <DetailItem label={t("shipment.offer.photos")} className="col-span-full">
            <PhotoGrid images={offer.images} />
          </DetailItem>
        )}
      </dl>
    </DetailSection>
  );
}

/** What the customer paid at checkout. The API never sends more of the card than its last 4 digits. */
export function PaymentSection({ payment }: { payment: PaymentSummary }) {
  const { t, i18n } = useTranslation("app");
  const format = useDetailFormat();

  return (
    <DetailSection title={t("shipment.payment.title")}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <DetailItem label={t("shipment.payment.quantity")}>
          <span className="tabular-nums">{payment.quantity}</span>
        </DetailItem>
        <DetailItem label={t("shipment.payment.total")}>
          <span className="tabular-nums">{formatMoney(payment.total, i18n.language)}</span>
        </DetailItem>
        <DetailItem label={t("shipment.payment.card")}>
          <span className="tabular-nums">{t("shipment.payment.cardEnding", { last4: payment.cardLast4 })}</span>
        </DetailItem>
        <DetailItem label={t("shipment.payment.submittedAt")}>
          <time dateTime={payment.submittedAt}>{format.dateTime(payment.submittedAt)}</time>
        </DetailItem>
      </dl>
    </DetailSection>
  );
}
