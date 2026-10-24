import { zodResolver } from "@hookform/resolvers/zod";
import type { RefObject } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useAddShipmentEvent, type AdminShipmentDetail } from "@trans/api";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@trans/ui/components/alert-dialog";
import { Button } from "@trans/ui/components/button";
import { Field, FieldError } from "@trans/ui/components/field";
import { Textarea } from "@trans/ui/components/textarea";
import { toast } from "@trans/ui/components/toaster";
import { focusOnClose } from "@trans/ui/hooks/use-return-focus";

import { actionError } from "./action-error";
import { cancelSchema, type CancelValues } from "./schemas";

/**
 * Cancels the shipment from any status that isn't final, after a confirmation
 * with a reason. It can't be undone. While the request runs the dialog stays
 * put; the form mounts with the content, so it starts fresh every time.
 */
export function CancelShipmentDialog({
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
  const cancel = useAddShipmentEvent();
  return (
    <AlertDialog open={open} onOpenChange={(next) => !cancel.isPending && onOpenChange(next)}>
      <AlertDialogContent
        // Start in the reason, not on "Keep shipment".
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={focusOnClose(returnFocusTo)}
      >
        <CancelForm shipment={shipment} cancel={cancel} onDone={() => onOpenChange(false)} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CancelForm({
  shipment,
  cancel,
  onDone,
}: {
  shipment: AdminShipmentDetail;
  cancel: ReturnType<typeof useAddShipmentEvent>;
  onDone: () => void;
}) {
  const { t } = useTranslation(["common", "app"]);
  const form = useForm<CancelValues>({ resolver: zodResolver(cancelSchema), defaultValues: { reason: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ reason }) => {
    try {
      // The backend has no reason field: a cancellation's `location` is its reason, shown in the timeline.
      await cancel.mutateAsync({ trackingId: shipment.trackingId, status: "cancelled", location: reason });
      toast.success(t("app:shipment.cancelForm.cancelled", { id: shipment.trackingId }));
      onDone();
    } catch (error) {
      form.setError("root", { message: actionError(error, t, "app:shipment.cancelForm.error") });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("app:shipment.cancelForm.title", { id: shipment.trackingId })}</AlertDialogTitle>
        <AlertDialogDescription>{t("app:shipment.cancelForm.description")}</AlertDialogDescription>
      </AlertDialogHeader>
      <div className="flex flex-col gap-3 px-6 pb-6">
        <Field
          label={t("app:shipment.cancelForm.reason")}
          hint={t("app:shipment.cancelForm.reasonHint")}
          error={errors.reason?.message}
        >
          <Textarea rows={2} maxLength={200} autoFocus {...form.register("reason")} />
        </Field>
        {errors.root?.message && <FieldError className="whitespace-pre-line">{errors.root.message}</FieldError>}
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={cancel.isPending}>{t("app:shipment.cancelForm.keep")}</AlertDialogCancel>
        <Button type="submit" variant="error" loading={cancel.isPending}>
          {t("app:shipment.cancelForm.confirm")}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}
