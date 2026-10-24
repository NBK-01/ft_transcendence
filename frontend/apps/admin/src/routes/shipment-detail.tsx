import { Package } from "lucide-react";
import { useParams } from "react-router";

import { PlaceholderPage } from "@trans/ui/blocks/placeholder-page";

import { useBranchFilter } from "../features/branches/use-branch-filter";

/** /shipments/:trackingId: one shipment (needs "shipments:read:all"). A placeholder until the page is built. */
export function ShipmentDetailPage() {
  const { trackingId = "" } = useParams();
  const { withBranch } = useBranchFilter();
  // Tracking IDs are upper case; the API finds them typed in any case.
  return <PlaceholderPage title={trackingId.trim().toUpperCase()} icon={Package} homeHref={withBranch("/")} />;
}
