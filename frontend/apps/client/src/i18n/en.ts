/** Client-only strings (namespace "app"). Shared strings live in @trans/ui (namespace "common"). */
const en = {
  pages: {
    shipments: "Track every parcel you've sent, live.",
    messages: "Talk to support and your branch about a shipment.",
    notifications: "Every status change and reply, in one feed.",
    profile: "Your details, avatar and contacts.",
  },
};

export default en;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type ClientResources = Widen<typeof en>;
