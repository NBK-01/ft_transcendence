import { ArrowLeft, Info, Minus, Plus, ReceiptText, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

import { isApiError } from "@trans/api";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Button } from "@trans/ui/components/button";
import { Card } from "@trans/ui/components/card";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { Skeleton } from "@trans/ui/components/skeleton";
import { toast } from "@trans/ui/components/toaster";

import { useShipment, useSubmitPayment } from "../features/shipments/api";
import {
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  isValidCardNumber,
  isValidCvc,
  parseExpiry,
} from "../features/shipments/card";
import { formatMoney } from "../features/shipments/format";
import type { ShipmentDetail } from "../features/shipments/types";

const MIN_QTY = 1;
const MAX_QTY = 99;

/** /app/shipments/:id/checkout — pay for an approved offer (pending_payment only). */
export function CheckoutPage() {
  const { t } = useTranslation(["common", "app"]);
  const { id = "" } = useParams();
  const { data, isPending, isError, error, refetch, isFetching } = useShipment(id);
  const backTo = `/app/shipments/${encodeURIComponent(id)}`;

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("app:shipments.checkout.title")} · ${t("brand.name")}`}</title>

      <Link
        to={backTo}
        className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-md text-label-14 text-gray-900 hover:text-gray-1000"
      >
        <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
        <span dir="ltr">{id}</span>
      </Link>

      <PageHeader title={t("app:shipments.checkout.title")} />

      {isPending ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : isError ? (
        <EmptyState
          icon={TriangleAlert}
          title={
            isApiError(error) && error.status === 404
              ? t("app:shipments.notFoundTitle")
              : t("app:shipments.detailErrorTitle")
          }
          description={t("app:shipments.errorBody")}
          action={
            <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
              {t("app:shipments.retry")}
            </Button>
          }
        />
      ) : data.status !== "pending_payment" || !data.offer ? (
        <EmptyState
          icon={ReceiptText}
          title={t("app:shipments.checkout.nothingToPayTitle")}
          description={t("app:shipments.checkout.nothingToPayBody")}
          action={
            <Button variant="secondary" asChild>
              <Link to={backTo}>{t("app:shipments.checkout.backToShipment")}</Link>
            </Button>
          }
        />
      ) : (
        <CheckoutForm shipment={data} />
      )}
    </div>
  );
}

type Errors = Partial<Record<"holderName" | "cardNumber" | "expiry" | "cvc" | "form", string>>;

function CheckoutForm({ shipment }: { shipment: ShipmentDetail }) {
  const { t, i18n } = useTranslation(["common", "app"]);
  const navigate = useNavigate();
  const pay = useSubmitPayment(shipment.trackingId);
  const offer = shipment.offer!;

  const [quantity, setQuantity] = useState(MIN_QTY);
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const unit = offer.unitPrice;
  const total = Math.round(unit.amount * quantity * 100) / 100;
  const money = (amount: number) => formatMoney(amount, unit.currency, i18n.language);
  const clamp = (value: number) => Math.min(MAX_QTY, Math.max(MIN_QTY, Number.isFinite(value) ? Math.trunc(value) : MIN_QTY));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const exp = parseExpiry(expiry);
    const next: Errors = {};
    if (!holderName.trim()) next.holderName = "app:shipments.checkout.errors.holderName";
    if (!isValidCardNumber(cardNumber)) next.cardNumber = "app:shipments.checkout.errors.cardNumber";
    if (!exp) next.expiry = "app:shipments.checkout.errors.expiry";
    if (!isValidCvc(cvc)) next.cvc = "app:shipments.checkout.errors.cvc";
    setErrors(next);
    if (Object.keys(next).length > 0 || !exp) return;

    // Only these leave the browser: never the full card number or the CVC.
    pay.mutate(
      {
        quantity,
        card: { holderName: holderName.trim(), last4: digitsOnly(cardNumber).slice(-4), expMonth: exp.month, expYear: exp.year },
      },
      {
        onSuccess: () => {
          toast.success(t("app:shipments.checkout.submitted"));
          void navigate(`/app/shipments/${encodeURIComponent(shipment.trackingId)}`);
        },
        onError: (err) =>
          setErrors({ form: isApiError(err) && err.messages[0] ? err.messages[0] : "app:shipments.errorBody" }),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Summary first in the DOM so phones see what they're paying for before the card form. */}
      <Card className="gap-4 px-5 py-5 lg:order-last">
        <h2 className="text-heading-16">{t("app:shipments.checkout.summary")}</h2>
        {offer.images[0] && (
          <img
            src={offer.images[0].url}
            alt={offer.images[0].name}
            className="aspect-[4/3] w-full rounded-lg border border-gray-alpha-400 object-cover"
          />
        )}
        <dl className="flex flex-col gap-3 text-copy-14">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-900">{t("app:shipments.details.supplier")}</dt>
            <dd className="text-end text-gray-1000">{offer.supplierName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-900">{t("app:shipments.checkout.unitPrice")}</dt>
            <dd className="text-gray-1000 tabular-nums">{money(unit.amount)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt id="qty-label" className="text-gray-900">
              {t("app:shipments.checkout.quantity")}
            </dt>
            <dd className="flex items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                shape="square"
                onClick={() => setQuantity((q) => clamp(q - 1))}
                disabled={quantity <= MIN_QTY}
                aria-label={t("app:shipments.checkout.decrease")}
              >
                <Minus aria-hidden="true" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={MIN_QTY}
                max={MAX_QTY}
                value={quantity}
                onChange={(event) => setQuantity(clamp(event.target.valueAsNumber))}
                aria-labelledby="qty-label"
                className="h-8 w-14 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                shape="square"
                onClick={() => setQuantity((q) => clamp(q + 1))}
                disabled={quantity >= MAX_QTY}
                aria-label={t("app:shipments.checkout.increase")}
              >
                <Plus aria-hidden="true" />
              </Button>
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-gray-alpha-400 pt-3">
            <dt className="text-label-16 text-gray-1000">{t("app:shipments.checkout.total")}</dt>
            <dd className="text-label-16 text-gray-1000 tabular-nums" aria-live="polite">
              {money(total)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="gap-5 px-5 py-5">
        <h2 className="text-heading-16">{t("app:shipments.checkout.payment")}</h2>
        <p className="flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2.5 text-copy-13 text-amber-900">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("app:shipments.checkout.demoNotice")}
        </p>

        {/* Demo form: autoComplete is off so the browser never fills in a real saved card. */}
        <Field label={t("app:shipments.checkout.holderName")} error={errors.holderName}>
          <Input autoComplete="off" value={holderName} onChange={(event) => setHolderName(event.target.value)} />
        </Field>
        <Field label={t("app:shipments.checkout.cardNumber")} error={errors.cardNumber}>
          <Input
            inputMode="numeric"
            autoComplete="off"
            placeholder="1234 1234 1234 1234"
            dir="ltr"
            className="font-mono"
            value={cardNumber}
            onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("app:shipments.checkout.expiry")} error={errors.expiry}>
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder="MM / YY"
              dir="ltr"
              className="font-mono"
              value={expiry}
              onChange={(event) => setExpiry(formatExpiry(event.target.value))}
            />
          </Field>
          <Field label={t("app:shipments.checkout.cvc")} error={errors.cvc}>
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder="123"
              maxLength={4}
              dir="ltr"
              className="font-mono"
              value={cvc}
              onChange={(event) => setCvc(digitsOnly(event.target.value).slice(0, 4))}
            />
          </Field>
        </div>

        {errors.form && <FieldError message={errors.form} />}

        <Button type="submit" variant="accent" size="lg" loading={pay.isPending}>
          {t("app:shipments.checkout.pay", { total: money(total) })}
        </Button>
      </Card>
    </form>
  );
}
