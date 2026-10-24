import {
  BadgeCheck,
  CreditCard,
  Hourglass,
  PackageCheck,
  PackageX,
  Search,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import { trackingMovesFrom, useStaffAccess, type AdminShipmentDetail, type ShipmentState } from "@trans/api";
import { WAITING_ON_ADMIN } from "@trans/ui/blocks/shipment-state";
import { Button } from "@trans/ui/components/button";
import { Card } from "@trans/ui/components/card";
import { useReturnFocus } from "@trans/ui/hooks/use-return-focus";
import { cn } from "@trans/ui/lib/utils";

import { CancelShipmentDialog } from "./cancel-shipment-dialog";
import { ConfirmPaymentDialog } from "./confirm-payment-dialog";
import { SendOfferDialog } from "./send-offer-dialog";
import { TrackingUpdateDialog } from "./tracking-update-dialog";

/** The step's own move. Cancelling is offered on top, in every status that isn't final. */
type StepAction = "offer" | "payment" | "tracking";
type OpenDialog = StepAction | "cancel";

type Step = {
  icon: LucideIcon;
  /** Key under app:shipment.next. */
  key: string;
  /** What the staff member does here, if their role may; otherwise who it's waiting on. */
  action?: StepAction;
};

const ACTION_LABEL: Record<StepAction, string> = {
  offer: "shipment.next.sendOffer",
  payment: "shipment.next.confirmPayment",
  tracking: "shipment.next.addUpdate",
};

/** What happens next, per status. Delivered and cancelled say there's nothing left. */
const STEPS: Partial<Record<ShipmentState, Step>> = {
  pending_sourcing: { icon: Search, key: "sourcing", action: "offer" },
  pending_client_decision: { icon: Hourglass, key: "decision" },
  pending_payment: { icon: CreditCard, key: "payment" },
  pending_payment_confirmation: { icon: BadgeCheck, key: "confirm", action: "payment" },
  confirmed: { icon: Truck, key: "live", action: "tracking" },
  in_transit: { icon: Truck, key: "live", action: "tracking" },
  out_for_delivery: { icon: Truck, key: "live", action: "tracking" },
  delivered: { icon: PackageCheck, key: "delivered" },
  cancelled: { icon: PackageX, key: "cancelled" },
};

/**
 * Under the header: where the shipment stands and what to do now. Only roles
 * with "shipments:update:org" get the actions (of the roles that can open this
 * page, the admin); support reads who it's waiting on instead.
 */
export function NextStep({ shipment }: { shipment: AdminShipmentDetail }) {
  const { t } = useTranslation("app");
  const canAct = useStaffAccess().can("shipments:update:org");
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { ref: openerRef, remember: rememberOpener } = useReturnFocus();

  // Focus goes back to the button that opened the dialog. After a change went
  // through, the status may have moved on and that button be gone: focus goes
  // to this step's title instead, which now says what's next.
  const returnFocusTo = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return openerRef.current?.isConnected ? openerRef.current : titleRef.current;
      },
    }),
    [openerRef],
  );

  const onOpenChange = (next: boolean) => {
    if (!next) setDialog(null);
  };

  const step = STEPS[shipment.status];
  const action = canAct ? step?.action : undefined;
  const canCancel = canAct && trackingMovesFrom(shipment.status).includes("cancelled");

  return (
    <>
      {step && (
        <Card
          className={cn(
            "flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
            // Waiting on staff, and this one can act: tinted, like the client's panel on their turn.
            canAct && WAITING_ON_ADMIN.has(shipment.status) && "border-blue-700/40 bg-blue-100/40",
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-gray-alpha-400 bg-background-100">
              <step.icon aria-hidden="true" className="size-4 text-gray-900" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-label-12 text-gray-900">{t("shipment.next.label")}</p>
              <h2 ref={titleRef} tabIndex={-1} className="text-label-16 text-gray-1000 outline-none">
                {t(`shipment.next.${step.key}Title`)}
              </h2>
              <p className="text-copy-14 text-pretty text-gray-900">
                {/* A step with an action reads differently for a role that can't take it: who it's waiting on. */}
                {t(`shipment.next.${step.key}${step.action && !canAct ? "BodyReadOnly" : "Body"}`)}
              </p>
            </div>
          </div>
          {(action || canCancel) && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {action && (
                <Button onFocus={rememberOpener} onClick={() => setDialog(action)}>
                  {t(ACTION_LABEL[action])}
                </Button>
              )}
              {canCancel && (
                <Button variant="secondary" onFocus={rememberOpener} onClick={() => setDialog("cancel")}>
                  {t("shipment.next.cancel")}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}
      {/*
       * Outside the card, so a dialog stays open while the shipment refreshes
       * under it (e.g. after a 409, when the step it came from may be gone).
       */}
      {canAct && (
        <>
          <SendOfferDialog
            open={dialog === "offer"}
            onOpenChange={onOpenChange}
            shipment={shipment}
            returnFocusTo={returnFocusTo}
          />
          <ConfirmPaymentDialog
            open={dialog === "payment"}
            onOpenChange={onOpenChange}
            shipment={shipment}
            returnFocusTo={returnFocusTo}
          />
          <TrackingUpdateDialog
            open={dialog === "tracking"}
            onOpenChange={onOpenChange}
            shipment={shipment}
            returnFocusTo={returnFocusTo}
          />
          <CancelShipmentDialog
            open={dialog === "cancel"}
            onOpenChange={onOpenChange}
            shipment={shipment}
            returnFocusTo={returnFocusTo}
          />
        </>
      )}
    </>
  );
}
