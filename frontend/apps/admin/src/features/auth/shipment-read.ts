import type { Permission } from "@trans/api";

/** Every shipment (admin, support), or one branch's (a dispatcher): either opens the shipments pages. */
export const SHIPMENT_READ = ["shipments:read:all", "shipments:read:org"] as const satisfies readonly Permission[];
