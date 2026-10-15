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
    errorTitle: "Couldn't load your shipments",
    errorBody: "Check your connection and try again.",
    retry: "Try again",
  },
};

export default en;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type ClientResources = Widen<typeof en>;
