import { z } from "zod";

/** Kept local to this feature for the same reason as checkout-schema.ts — admin has no equivalent form. */

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Only the "by link" tab's field — "by photos" has no text input, just a required-file-count check. */
export const newShipmentLinkSchema = z.object({
  productUrl: z
    .string()
    .trim()
    .min(1, { error: "app:shipments.newForm.urlRequired" })
    .refine(isHttpUrl, { error: "app:shipments.newForm.urlInvalid" }),
});
export type NewShipmentLinkValues = z.infer<typeof newShipmentLinkSchema>;
