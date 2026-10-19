import { CircleCheck, Clock, CreditCard, Search, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { isApiError } from "@trans/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@trans/ui/components/alert-dialog";
import { Button } from "@trans/ui/components/button";
import { Card } from "@trans/ui/components/card";
import { FieldError } from "@trans/ui/components/field";
import { cn } from "@trans/ui/lib/utils";

import { useAcceptOffer, useRejectOffer } from "./api";
import { formatMoney } from "./format";
import { ImageGrid } from "./image-grid";
import type { ShipmentDetail } from "./types";

/**
 * What the client sees above the tabs while the order isn't live yet: what's
 * happening, and the one action they can take (approve/reject, pay), if any.
 * Renders nothing once tracking has started.
 */
export function OrderStagePanel({ shipment }: { shipment: ShipmentDetail }) {
  switch (shipment.status) {
    case "pending_sourcing":
      return <Waiting icon={Search} stage="sourcing" />;
    case "pending_client_decision":
      return shipment.offer ? <OfferDecision shipment={shipment} /> : null;
    case "pending_payment":
      return <ReadyToPay shipment={shipment} />;
    case "pending_payment_confirmation":
      return <PaymentSubmitted shipment={shipment} />;
    default:
      return null;
  }
}

function Panel({
  icon: Icon,
  title,
  body,
  highlight = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  /** The client's turn: tinted border so it stands out. */
  highlight?: boolean;
  children?: ReactNode;
}) {
  return (
    <Card
      role="status"
      className={cn("max-w-2xl gap-4 px-5 py-4", highlight && "border-blue-700/40 bg-blue-100/40")}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-gray-alpha-400 bg-background-100">
          <Icon aria-hidden="true" className="size-4 text-gray-900" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-label-16 text-gray-1000">{title}</h2>
          <p className="text-copy-14 text-pretty text-gray-900">{body}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

/** Nothing to do: the admin has the next move. The page polls, so it updates by itself. */
function Waiting({ icon, stage, children }: { icon: LucideIcon; stage: "sourcing" | "confirming"; children?: ReactNode }) {
  const { t } = useTranslation("app");
  return (
    <Panel icon={icon} title={t(`shipments.panel.${stage}Title`)} body={t(`shipments.panel.${stage}Body`)}>
      {children}
      <p className="text-label-12 text-gray-900">{t("shipments.panel.autoUpdate")}</p>
    </Panel>
  );
}

function OfferDecision({ shipment }: { shipment: ShipmentDetail }) {
  const { t, i18n } = useTranslation(["common", "app"]);
  const accept = useAcceptOffer(shipment.trackingId);
  const reject = useRejectOffer(shipment.trackingId);
  const offer = shipment.offer!;
  const busy = accept.isPending || reject.isPending;
  const failure = accept.error ?? reject.error;

  return (
    <Panel
      icon={CircleCheck}
      title={t("app:shipments.panel.offerTitle")}
      body={t("app:shipments.panel.offerBody")}
      highlight
    >
      <dl className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-label-12 text-gray-900">{t("app:shipments.details.supplier")}</dt>
          <dd className="text-label-16 text-gray-1000">{offer.supplierName}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-label-12 text-gray-900">{t("app:shipments.checkout.unitPrice")}</dt>
          <dd className="text-label-16 text-gray-1000 tabular-nums">
            {formatMoney(offer.unitPrice.amount, offer.unitPrice.currency, i18n.language)}
          </dd>
        </div>
      </dl>
      {offer.note && <p className="text-copy-14 text-gray-1000">{offer.note}</p>}
      <ImageGrid images={offer.images} />

      {failure && (
        <FieldError
          message={isApiError(failure) && failure.messages[0] ? failure.messages[0] : "app:shipments.errorBody"}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={accept.isPending} disabled={busy} onClick={() => accept.mutate()}>
          {t("app:shipments.panel.approve")}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="secondary" loading={reject.isPending} disabled={busy}>
              {t("app:shipments.panel.reject")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("app:shipments.panel.rejectTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("app:shipments.panel.rejectBody")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => reject.mutate()}>{t("app:shipments.panel.reject")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Panel>
  );
}

function ReadyToPay({ shipment }: { shipment: ShipmentDetail }) {
  const { t } = useTranslation("app");
  return (
    <Panel icon={CreditCard} title={t("shipments.panel.payTitle")} body={t("shipments.panel.payBody")} highlight>
      <Button variant="accent" className="w-fit" asChild>
        <Link to={`/app/shipments/${encodeURIComponent(shipment.trackingId)}/checkout`}>
          {t("shipments.panel.goToCheckout")}
        </Link>
      </Button>
    </Panel>
  );
}

function PaymentSubmitted({ shipment }: { shipment: ShipmentDetail }) {
  const { t, i18n } = useTranslation("app");
  const { payment } = shipment;
  return (
    <Waiting icon={Clock} stage="confirming">
      {payment && (
        <p className="text-label-14 text-gray-1000 tabular-nums">
          {t("shipments.panel.paidSummary", {
            quantity: payment.quantity,
            total: formatMoney(payment.total.amount, payment.total.currency, i18n.language),
            last4: payment.cardLast4,
          })}
        </p>
      )}
    </Waiting>
  );
}
