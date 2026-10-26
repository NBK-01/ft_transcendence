import { z } from "zod";

import { isValidCardNumber, isValidCvc, parseExpiry } from "./card";

/**
 * Kept local to this feature, not in packages/ui/src/schemas (unlike auth/profile):
 * it reuses card.ts's Luhn check and expiry parser, and admin has no payment
 * flow to ever share this with — moving it would either duplicate that logic
 * or make packages/ui depend on an app, neither of which is worth it here.
 */

export const MIN_QTY = 1;
export const MAX_QTY = 99;

export const checkoutSchema = z.object({
  quantity: z.number().int().min(MIN_QTY).max(MAX_QTY),
  holderName: z.string().trim().min(1, { error: "app:shipments.checkout.errors.holderName" }),
  cardNumber: z.string().refine(isValidCardNumber, { error: "app:shipments.checkout.errors.cardNumber" }),
  expiry: z.string().refine((value) => parseExpiry(value) !== null, { error: "app:shipments.checkout.errors.expiry" }),
  cvc: z.string().refine(isValidCvc, { error: "app:shipments.checkout.errors.cvc" }),
});
export type CheckoutValues = z.infer<typeof checkoutSchema>;
