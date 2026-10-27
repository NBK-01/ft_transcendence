import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type RefObject } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  FILE_TOO_LARGE,
  INVALID_FILE_TYPE,
  isApiError,
  TOO_MANY_SHIPMENT_IMAGES,
  useSendShipmentOffer,
  type AdminShipmentDetail,
} from "@trans/api";
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
import { Progress } from "@trans/ui/components/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trans/ui/components/select";
import { Textarea } from "@trans/ui/components/textarea";
import { toast } from "@trans/ui/components/toaster";
import { focusOnClose } from "@trans/ui/hooks/use-return-focus";

import { actionError } from "./action-error";
import { useCurrencyOptions } from "./form-options";
import { OfferPhotoPicker } from "./offer-photo-picker";
import { offerSchema, type OfferInput, type OfferValues } from "./schemas";

/** The photo problems the backend reports with a code: shown on the photos, not the whole form. */
const PHOTO_ERRORS: Record<number, string> = {
  [TOO_MANY_SHIPMENT_IMAGES]: "app:shipment.offerForm.tooManyPhotos",
  [INVALID_FILE_TYPE]: "app:shipment.offerForm.photoType",
  [FILE_TOO_LARGE]: "app:shipment.offerForm.photoSize",
};

/**
 * pending_sourcing → pending_client_decision: the supplier, the price of one
 * unit and optional photos, for the customer to approve or reject. The form
 * mounts with the dialog's content, so it starts fresh every time it opens.
 */
export function SendOfferDialog({
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
  const { t } = useTranslation("app");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A long form on a short screen scrolls inside the dialog, between a fixed header and footer. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl" onCloseAutoFocus={focusOnClose(returnFocusTo)}>
        <DialogHeader>
          <DialogTitle>{t("shipment.offerForm.title")}</DialogTitle>
          <DialogDescription>{t("shipment.offerForm.description", { name: shipment.client.name })}</DialogDescription>
        </DialogHeader>
        <OfferForm shipment={shipment} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function OfferForm({ shipment, onDone }: { shipment: AdminShipmentDetail; onDone: () => void }) {
  const { t, i18n } = useTranslation(["common", "app"]);
  const send = useSendShipmentOffer();
  const currencies = useCurrencyOptions();
  // 0 to 1 while the photos are sent; null otherwise.
  const [progress, setProgress] = useState<number | null>(null);
  const form = useForm<OfferInput, unknown, OfferValues>({
    resolver: zodResolver(offerSchema),
    defaultValues: { supplierName: "", unitPrice: "", currency: "", note: "", images: [] },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ note, ...values }) => {
    setProgress(values.images.length > 0 ? 0 : null);
    try {
      await send.mutateAsync({
        trackingId: shipment.trackingId,
        ...values,
        ...(note && { note }),
        onProgress: setProgress,
      });
      toast.success(t("app:shipment.offerForm.sent", { name: shipment.client.name }));
      onDone();
    } catch (error) {
      const photoError = isApiError(error) && error.errorCode !== undefined ? PHOTO_ERRORS[error.errorCode] : undefined;
      if (photoError) form.setError("images", { message: photoError });
      else form.setError("root", { message: actionError(error, t, "app:shipment.offerForm.error") });
    } finally {
      setProgress(null);
    }
  });
  const percent = progress !== null && new Intl.NumberFormat(`${i18n.language}-u-nu-latn`, { style: "percent" }).format(progress);

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogBody className="flex min-h-0 flex-col gap-5 overflow-y-auto">
        <Field label={t("app:shipment.offerForm.supplier")} error={errors.supplierName?.message}>
          <Input autoComplete="off" maxLength={200} autoFocus {...form.register("supplierName")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("app:shipment.offerForm.unitPrice")} error={errors.unitPrice?.message}>
            <Input inputMode="decimal" autoComplete="off" {...form.register("unitPrice")} />
          </Field>
          {/* Select's root renders no element, so the Field's label and error land on the trigger. */}
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <Field label={t("app:shipment.offerForm.currency")} error={errors.currency?.message}>
                  <SelectTrigger ref={field.ref} onBlur={field.onBlur}>
                    <SelectValue placeholder={t("app:shipment.offerForm.currencyPlaceholder")} />
                  </SelectTrigger>
                </Field>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <Field
          label={t("app:shipment.offerForm.note")}
          hint={t("app:shipment.offerForm.noteHint")}
          error={errors.note?.message}
        >
          <Textarea rows={3} maxLength={1000} {...form.register("note")} />
        </Field>
        <Controller
          control={form.control}
          name="images"
          render={({ field }) => (
            <Field
              label={t("app:shipment.offerForm.photos")}
              hint={t("app:shipment.offerForm.photosHint")}
              error={errors.images?.message}
            >
              <OfferPhotoPicker
                value={field.value}
                onChange={(files) => {
                  field.onChange(files);
                  form.clearErrors("images");
                }}
                onReject={(message) => form.setError("images", { message })}
              />
            </Field>
          )}
        />
        {progress !== null && (
          <Progress
            value={progress}
            label={t("app:shipment.uploadForm.progress")}
            caption={t("app:shipment.uploadForm.uploading", { percent })}
          />
        )}
        {errors.root?.message && <FieldError className="whitespace-pre-line">{errors.root.message}</FieldError>}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" disabled={send.isPending}>
            {t("actions.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" loading={send.isPending}>
          {t("app:shipment.offerForm.send")}
        </Button>
      </DialogFooter>
    </form>
  );
}
