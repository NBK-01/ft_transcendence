/** Client-only strings (namespace "app"). Shared strings live in @trans/ui (namespace "common"). */
const en = {
  pages: {
    shipments: "Track every parcel you've sent, live.",
    messages: "Talk to support and your branch about a shipment.",
    notifications: "Every status change and reply, in one feed.",
    profile: "Your details, avatar and contacts.",
  },
  shipments: {
    listLabel: "Your shipments",
    columns: { trackingId: "Tracking ID", route: "Route", status: "Status", updatedAt: "Last update" },
    emptyTitle: "No shipments yet",
    emptyBody: "Shipments you send will appear here with their live status.",
    newShipment: "New shipment",
    errorTitle: "Couldn't load your shipments",
    errorBody: "Check your connection and try again.",
    retry: "Try again",
    searchLabel: "Search by tracking ID",
    searchPlaceholder: "Tracking ID, e.g. TRK-8F3A21",
    statusLabel: "Filter by status",
    allStatuses: "All statuses",
    noMatchTitle: "No shipments match",
    noMatchBody: "Try another tracking ID or status.",
    clearFilters: "Clear filters",
    backToList: "All shipments",
    eyebrow: "Shipment",
    copyTrackingId: "Copy tracking ID",
    copyFailed: "Couldn't copy. Select the tracking ID and copy it manually.",
    notFoundTitle: "Shipment not found",
    notFoundBody: "No shipment with tracking ID {{id}} on your account.",
    detailErrorTitle: "Couldn't load this shipment",
    tabs: { timeline: "Timeline", details: "Details", files: "Files" },
    details: { from: "From", to: "To", weight: "Weight", declaredValue: "Declared value" },
    files: {
      open: "Open",
      emptyTitle: "No files yet",
      emptyBody: "Package photos and proof of delivery will appear here.",
      errorTitle: "Couldn't load the files",
      kind: { package_photo: "Package photo", proof_of_delivery: "Proof of delivery", other: "Document" },
    },
    timelineLabel: "Shipment history",
    timelineEmpty: "No updates yet",
    timelineErrorTitle: "Couldn't load the timeline",
  },
};

export default en;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type ClientResources = Widen<typeof en>;
