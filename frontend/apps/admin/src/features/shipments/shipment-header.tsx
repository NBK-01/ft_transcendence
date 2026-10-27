import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useAdminShipmentEvents, useStaffAccess, type AdminShipmentDetail } from "@trans/api";
import { ShipmentStateBadge } from "@trans/ui/blocks/shipment-state";
import { Button } from "@trans/ui/components/button";
import { CopyButton } from "@trans/ui/components/copy-button";

import { useBranchFilter } from "../branches/use-branch-filter";
import { AssignBranchDialog } from "./assign-branch-dialog";
import { DetailItem } from "./detail-parts";
import { useDetailFormat } from "./use-detail-format";

/**
 * The shared PageHeader's frame, but the title is the tracking ID in mono with
 * a copy button and the status, and under it who ordered it, which branch
 * has it (a partner's, or the one an admin handed a customer's order to) and
 * when. Admins can change the branch of a customer's order here.
 */
export function ShipmentHeader({ shipment }: { shipment: AdminShipmentDetail }) {
  const { t } = useTranslation("app");
  const format = useDetailFormat();
  const { withBranch } = useBranchFilter();
  const { can } = useStaffAccess();
  const { trackingId, client, organization, createdAt, updatedAt } = shipment;
  // Newest first: the last step is how it started. A partner's shipment starts at confirmed, and keeps its branch.
  const events = useAdminShipmentEvents(trackingId).data;
  const fromPartner = events?.at(-1)?.status === "confirmed";
  const canAssign = can("organizations:manage") && events !== undefined && !fromPartner;
  const [assigning, setAssigning] = useState(false);
  const assignButton = useRef<HTMLButtonElement>(null);

  return (
    <header className="flex flex-col gap-5 border-b border-gray-alpha-400 pb-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-1">
          <h1 className="truncate font-mono text-heading-32">{trackingId}</h1>
          <CopyButton value={trackingId} label={t("shipment.copyTrackingId")} />
        </div>
        <ShipmentStateBadge status={shipment.status} size="lg" />
      </div>
      <dl className="flex flex-wrap gap-x-10 gap-y-4">
        <DetailItem label={t("shipment.customer")}>
          <span className="block truncate">
            <bdi>{client.name}</bdi>
          </span>
          <span className="block truncate">
            <a
              href={`mailto:${client.email}`}
              dir="ltr"
              className="focus-ring rounded-sm text-gray-900 hover:text-gray-1000 hover:underline"
            >
              {client.email}
            </a>
          </span>
        </DetailItem>
        <DetailItem label={t("shipment.branch")}>
          <span className="flex items-center gap-2">
            {organization ? (
              <Link
                to={withBranch(`/branches/${encodeURIComponent(organization.id)}`)}
                className="focus-ring block truncate rounded-sm hover:underline"
              >
                <bdi>{organization.name}</bdi>
              </Link>
            ) : (
              <span className="block text-gray-900">{t("shipment.noBranch")}</span>
            )}
            {canAssign && (
              <Button ref={assignButton} variant="tertiary" size="tiny" onClick={() => setAssigning(true)}>
                {t("shipment.assignBranch.action")}
              </Button>
            )}
          </span>
        </DetailItem>
        <DetailItem label={t("shipment.created")}>
          <time dateTime={createdAt}>{format.dateTime(createdAt)}</time>
        </DetailItem>
        <DetailItem label={t("shipment.updated")}>
          <time dateTime={updatedAt}>{format.dateTime(updatedAt)}</time>
        </DetailItem>
      </dl>
      {canAssign && (
        <AssignBranchDialog
          open={assigning}
          onOpenChange={setAssigning}
          shipment={shipment}
          returnFocusTo={assignButton}
        />
      )}
    </header>
  );
}
