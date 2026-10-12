/** Admin-only strings (namespace "app"). Shared strings live in @trans/ui (namespace "common"). */
const en = {
  logoLabel: "Admin",
  groups: {
    operations: "Operations",
    manage: "Manage",
  },
  pages: {
    dashboard: "Live view of shipments, branches and staff.",
    shipments: "Every shipment across the branches you can access.",
    messages: "Conversations between staff and customers.",
    users: "Create, edit and remove accounts, and assign roles.",
    branches: "Branches are organizations: members, address and shipments.",
    apiKeys: "Keys that let partner systems use the public API.",
    profile: "Your account details.",
  },
};

export default en;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type AdminResources = Widen<typeof en>;
