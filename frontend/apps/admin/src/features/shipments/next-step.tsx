import { BadgeCheck, CreditCard, Hourglass, Search, Truck, type LucideIcon } from "lucide-react";
import { useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import { useStaffAccess, type AdminShipmentDetail, type ShipmentState } from "@trans/api";
import { Button } from "@trans/ui/components/button";
import { Card } from "@trans/ui/components/card";
import { useReturnFocus } from "@trans/ui/hooks/use-return-focus";
import { cn } from "@trans/ui/lib/utils";

import { ConfirmPaymentDialog } from "./confirm-payment-dialog";
import { SendOfferDialog } from "./send-offer-dialog";

type Action = "offer" | "payment";

type Step = {
  icon: LucideIcon;
  /** Key under app:shipment.next. */
  key: string;
  /** What the staff member does here, if their role may; otherwise who it's waiting on. */
  action?: Action;
};

/** What happens next, per status. Delivered and cancelled shipments have nothing next. */
const STEPS: Partial<Record<ShipmentState, Step>> = {
  pending_sourcing: { icon: Search, key: "sourcing", action: "offer" },
  pending_client_decision: { icon: Hourglass, key: "decision" },
  pending_payment: { icon: CreditCard, key: "payment" },
  pending_payment_confirmation: { icon: BadgeCheck, key: "confirm", action: "payment" },
  confirmed: { icon: Truck, key: "live" },
  in_transit: { icon: Truck, key: "live" },
  out_for_delivery: { icon: Truck, key: "live" },
};

/**
 * Under the header: where the shipment stands and the one thing to do now.
 * Only roles with "shipments:update:org" get the action (of the roles that can
 * open this page, the admin); support reads who it's waiting on instead.
 */
export function NextStep({ shipment }: { shipment: AdminShipmentDetail }) {
  const { t } = useTranslation("app");
  const canAct = useStaffAccess().can("shipments:update:org");
  const [dialog, setDialog] = useState<Action | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { ref: openerRef, remember: rememberOpener } = useReturnFocus();

  // Focus goes back to the button that opened the dialog. After a change went
  // through, the status has moved on and that button is gone: focus goes to
  // this step's title instead, which now says what's next.
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

  return (
    <>
      {step && (
        <Card
          className={cn(
            "flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
            // The staff member's turn: tinted, like the client app's panel on the customer's turn.
            action && "border-blue-700/40 bg-blue-100/40",
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
          {action && (
            <Button className="w-fit shrink-0" onFocus={rememberOpener} onClick={() => setDialog(action)}>
              {t(action === "offer" ? "shipment.next.sendOffer" : "shipment.next.confirmPayment")}
            </Button>
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
        </>
      )}
    </>
  );
}
