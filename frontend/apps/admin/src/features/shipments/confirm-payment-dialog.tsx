import { zodResolver } from "@hookform/resolvers/zod";
import type { RefObject } from "react";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useConfirmShipmentPayment, type Address, type AdminShipmentDetail } from "@trans/api";
import { Button } from "@trans/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@trans/ui/components/dialog";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trans/ui/components/select";
import { toast } from "@trans/ui/components/toaster";
import { focusOnClose } from "@trans/ui/hooks/use-return-focus";

import { actionError } from "./action-error";
import { formatMoney } from "./format";
import { useCountryOptions } from "./form-options";
import { paymentSchema, type AddressValues, type PaymentInput, type PaymentValues } from "./schemas";

type PaymentForm = UseFormReturn<PaymentInput, unknown, PaymentValues>;

/** The optional fields go out only when filled in: the API takes a missing field, not "". */
const toAddress = ({ postalCode, phone, ...address }: AddressValues): Address => ({
  ...address,
  ...(postalCode && { postalCode }),
  ...(phone && { phone }),
});

/**
 * pending_payment_confirmation → confirmed: the admin has checked the payment
 * and sets where the order ships from and to, and its weight. The form mounts
 * with the dialog's content, so it starts fresh every time it opens.
 */
export function ConfirmPaymentDialog({
  open,
  onOpenChange,
  shipment,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: AdminShipmentDetail;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const { t, i18n } = useTranslation("app");
  const { payment } = shipment;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A long form on a short screen scrolls inside the dialog, between a fixed header and footer. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl" onCloseAutoFocus={focusOnClose(returnFocusTo)}>
        <DialogHeader>
          <DialogTitle>{t("shipment.paymentForm.title")}</DialogTitle>
          <DialogDescription>
            {payment &&
              `${t("shipment.paymentForm.paid", {
                total: formatMoney(payment.total, i18n.language),
                last4: payment.cardLast4,
              })} `}
            {t("shipment.paymentForm.description")}
          </DialogDescription>
        </DialogHeader>
        <PaymentForm shipment={shipment} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({ shipment, onDone }: { shipment: AdminShipmentDetail; onDone: () => void }) {
  const { t } = useTranslation(["common", "app"]);
  const confirm = useConfirmShipmentPayment();
  const blank = { name: "", street: "", city: "", postalCode: "", country: "", phone: "" };
  const form = useForm<PaymentInput, unknown, PaymentValues>({
    resolver: zodResolver(paymentSchema),
    // Only the names are known: the sender is usually the supplier, the recipient the customer.
    defaultValues: {
      sender: { ...blank, name: shipment.offer?.supplierName ?? "" },
      recipient: { ...blank, name: shipment.client.name },
      weightKg: "",
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ sender, recipient, weightKg }) => {
    try {
      const confirmed = await confirm.mutateAsync({
        trackingId: shipment.trackingId,
        sender: toAddress(sender),
        recipient: toAddress(recipient),
        weightKg,
      });
      toast.success(t("app:shipment.paymentForm.confirmed", { id: confirmed.trackingId }));
      onDone();
    } catch (error) {
      form.setError("root", { message: actionError(error, t, "app:shipment.paymentForm.error") });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogBody className="flex min-h-0 flex-col gap-6 overflow-y-auto">
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          <AddressFields
            form={form}
            prefix="sender"
            legend={t("app:shipment.paymentForm.sender")}
            hint={t("app:shipment.paymentForm.senderHint")}
            autoFocus
          />
          <AddressFields
            form={form}
            prefix="recipient"
            legend={t("app:shipment.paymentForm.recipient")}
            hint={t("app:shipment.paymentForm.recipientHint")}
          />
        </div>
        <Field
          label={t("app:shipment.paymentForm.weight")}
          hint={t("app:shipment.paymentForm.weightHint")}
          error={errors.weightKg?.message}
          className="sm:max-w-60"
        >
          <Input inputMode="decimal" autoComplete="off" {...form.register("weightKg")} />
        </Field>
        {errors.root?.message && <FieldError className="whitespace-pre-line">{errors.root.message}</FieldError>}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" disabled={confirm.isPending}>
            {t("actions.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" loading={confirm.isPending}>
          {t("app:shipment.paymentForm.confirm")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * One address. These are someone else's, so the browser isn't asked to fill
 * in the admin's own (autoComplete off).
 */
function AddressFields({
  form,
  prefix,
  legend,
  hint,
  autoFocus = false,
}: {
  form: PaymentForm;
  prefix: "sender" | "recipient";
  legend: string;
  hint: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation(["common", "app"]);
  const countries = useCountryOptions();
  const errors = form.formState.errors[prefix];
  const optional = t("app:shipment.paymentForm.optional");

  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="flex flex-col gap-0.5 pb-4">
        <span className="text-label-14 font-medium text-gray-1000">{legend}</span>
        <span className="text-copy-13 text-gray-900">{hint}</span>
      </legend>
      <Field label={t("app:shipment.paymentForm.name")} error={errors?.name?.message}>
        <Input autoComplete="off" maxLength={200} autoFocus={autoFocus} {...form.register(`${prefix}.name`)} />
      </Field>
      <Field label={t("app:shipment.paymentForm.street")} error={errors?.street?.message}>
        <Input autoComplete="off" maxLength={200} {...form.register(`${prefix}.street`)} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
        <Field label={t("app:shipment.paymentForm.city")} error={errors?.city?.message}>
          <Input autoComplete="off" maxLength={100} {...form.register(`${prefix}.city`)} />
        </Field>
        <Field label={t("app:shipment.paymentForm.postalCode")} hint={optional} error={errors?.postalCode?.message}>
          <Input autoComplete="off" maxLength={20} dir="ltr" {...form.register(`${prefix}.postalCode`)} />
        </Field>
      </div>
      <Controller
        control={form.control}
        name={`${prefix}.country`}
        render={({ field }) => (
          <Select value={field.value || undefined} onValueChange={field.onChange}>
            <Field label={t("app:shipment.paymentForm.country")} error={errors?.country?.message}>
              <SelectTrigger ref={field.ref} onBlur={field.onBlur}>
                <SelectValue placeholder={t("app:shipment.paymentForm.countryPlaceholder")} />
              </SelectTrigger>
            </Field>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.value} value={country.value}>
                  {country.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <Field label={t("app:shipment.paymentForm.phone")} hint={optional} error={errors?.phone?.message}>
        <Input type="tel" autoComplete="off" maxLength={30} dir="ltr" {...form.register(`${prefix}.phone`)} />
      </Field>
    </fieldset>
  );
}
