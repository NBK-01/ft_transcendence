import { zodResolver } from "@hookform/resolvers/zod";
import type { RefObject } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { trackingMovesFrom, useAddShipmentEvent, type AdminShipmentDetail, type ShipmentState } from "@trans/api";
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
import { toast } from "@trans/ui/components/toaster";
import { focusOnClose } from "@trans/ui/hooks/use-return-focus";

import { actionError } from "./action-error";
import { ChoiceList } from "./choice-list";
import { trackingSchema, type TrackingInput, type TrackingMove, type TrackingValues } from "./schemas";

/** Forward first: out for delivery before another hop, delivered before a failed delivery. */
const FORWARD_FIRST: readonly TrackingMove[] = ["delivered", "out_for_delivery", "in_transit"];

/** What a move means for people, which depends on where it moves from (key under app:shipment.trackingForm.moves). */
function moveName(from: ShipmentState, to: TrackingMove) {
  if (to === "out_for_delivery") return "outForDelivery";
  if (to === "delivered") return "delivered";
  if (from === "in_transit") return "anotherHop";
  if (from === "out_for_delivery") return "deliveryFailed";
  return "pickedUp";
}

/**
 * A tracking update: one of the moves the current status allows (backend
 * TRACKING_TRANSITIONS; cancelling has its own dialog) and where it happened.
 * The form mounts with the dialog's content, so it starts fresh every time it opens.
 */
export function TrackingUpdateDialog({
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg" onCloseAutoFocus={focusOnClose(returnFocusTo)}>
        <DialogHeader>
          <DialogTitle>{t("shipment.trackingForm.title")}</DialogTitle>
          <DialogDescription>{t("shipment.trackingForm.description")}</DialogDescription>
        </DialogHeader>
        <TrackingForm shipment={shipment} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function TrackingForm({ shipment, onDone }: { shipment: AdminShipmentDetail; onDone: () => void }) {
  const { t } = useTranslation(["common", "app"]);
  const addEvent = useAddShipmentEvent();
  const allowed = trackingMovesFrom(shipment.status);
  const moves = FORWARD_FIRST.filter((move) => allowed.includes(move));
  // A single move is the only answer, so it's picked already; with two, the admin chooses.
  const only = moves.length === 1 ? moves[0] : undefined;
  const form = useForm<TrackingInput, unknown, TrackingValues>({
    resolver: zodResolver(trackingSchema),
    defaultValues: { status: only ?? "", location: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ status, location }) => {
    try {
      await addEvent.mutateAsync({ trackingId: shipment.trackingId, status, location });
      toast.success(t("app:shipment.trackingForm.posted", { status: t(`status.${status}`) }));
      onDone();
    } catch (error) {
      form.setError("root", { message: actionError(error, t, "app:shipment.trackingForm.error") });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogBody className="flex min-h-0 flex-col gap-5 overflow-y-auto">
        <ChoiceList
          legend={t("app:shipment.trackingForm.move")}
          choices={moves.map((move) => {
            const name = moveName(shipment.status, move);
            return {
              value: move,
              label: t(`app:shipment.trackingForm.moves.${name}.label`),
              hint: t(`app:shipment.trackingForm.moves.${name}.hint`),
            };
          })}
          error={errors.status?.message}
          autoFocus={!only}
          {...form.register("status")}
        />
        <Field
          label={t("app:shipment.trackingForm.location")}
          hint={t("app:shipment.trackingForm.locationHint")}
          error={errors.location?.message}
        >
          <Input autoComplete="off" maxLength={200} autoFocus={Boolean(only)} {...form.register("location")} />
        </Field>
        {errors.root?.message && <FieldError className="whitespace-pre-line">{errors.root.message}</FieldError>}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" disabled={addEvent.isPending}>
            {t("actions.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" loading={addEvent.isPending}>
          {t("app:shipment.trackingForm.post")}
        </Button>
      </DialogFooter>
    </form>
  );
}
