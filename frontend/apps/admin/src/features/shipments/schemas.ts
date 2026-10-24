import { z } from "zod";

import {
  ATTACHMENT_KINDS,
  MAX_OFFER_IMAGES,
  MAX_SHIPMENT_FILE_BYTES,
  SHIPMENT_FILE_TYPES,
  SHIPMENT_IMAGE_TYPES,
  type TrackingEventStatus,
} from "@trans/api";

/**
 * The forms on the shipment page. Error messages are i18n keys, rendered by
 * <Field>. Limits copy the backend DTOs (CreateOfferDto, ConfirmPaymentDto,
 * AddressDto, CreateEventDto, UploadFileDto), which check them again. The inputs also carry `maxLength`, so
 * "too long" only shows for pasted text that gets past it.
 */

const REQUIRED = "validation.required";
const TOO_LONG = "app:shipment.form.tooLong";

/** @IsString @IsNotEmpty @MaxLength: sent trimmed. */
const text = (max: number) => z.string().trim().min(1, { error: REQUIRED }).max(max, { error: TOO_LONG });

/** @IsOptional @IsString @MaxLength: "" when left empty, and then not sent. */
const optionalText = (max: number) => z.string().trim().max(max, { error: TOO_LONG });

/** Arabic-Indic and Persian digits, and the Arabic decimal separator, as typed on an Arabic keyboard. */
const toLatinDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".");

/**
 * @IsNumber({ maxDecimalPlaces: 2 }) @Min @Max, typed as text: "24.9", "24,9"
 * (a French keyboard) or Arabic digits all become 24.9.
 */
const amount = (min: number, max: number, error: string) =>
  z
    .string()
    .trim()
    .min(1, { error: REQUIRED })
    .transform(toLatinDigits)
    .pipe(z.string().regex(/^\d+([.,]\d{1,2})?$/, { error }))
    .transform((value) => Number(value.replace(",", ".")))
    .pipe(z.number().min(min, { error }).max(max, { error }));

const isOfferImage = (file: File) => (SHIPMENT_IMAGE_TYPES as readonly string[]).includes(file.type);

/** POST /admin/shipments/:trackingId/offer. The photo picker already leaves out what these checks would refuse. */
export const offerSchema = z.object({
  supplierName: text(200),
  unitPrice: amount(0.01, 1_000_000, "app:shipment.offerForm.unitPriceRange"),
  /** ISO 4217, from a list of the codes the browser knows. */
  currency: z.string().min(1, { error: REQUIRED }),
  note: optionalText(1000),
  images: z
    .array(z.instanceof(File))
    .max(MAX_OFFER_IMAGES, { error: "app:shipment.offerForm.tooManyPhotos" })
    .refine((files) => files.every(isOfferImage), { error: "app:shipment.offerForm.photoType" })
    .refine((files) => files.every((file) => file.size <= MAX_SHIPMENT_FILE_BYTES), {
      error: "app:shipment.offerForm.photoSize",
    }),
});
export type OfferInput = z.input<typeof offerSchema>;
export type OfferValues = z.output<typeof offerSchema>;

const addressSchema = z.object({
  name: text(200),
  street: text(200),
  city: text(100),
  postalCode: optionalText(20),
  /** ISO 3166-1 alpha-2, from the country list. */
  country: z.string().min(1, { error: REQUIRED }),
  phone: optionalText(30),
});
export type AddressValues = z.output<typeof addressSchema>;

/** POST /admin/shipments/:trackingId/payment/confirm. */
export const paymentSchema = z.object({
  sender: addressSchema,
  recipient: addressSchema,
  weightKg: amount(0.01, 100_000, "app:shipment.paymentForm.weightRange"),
});
export type PaymentInput = z.input<typeof paymentSchema>;
export type PaymentValues = z.output<typeof paymentSchema>;

/** The moves a tracking update offers. Cancelling goes through its own dialog. */
const TRACKING_MOVES = ["in_transit", "out_for_delivery", "delivered"] as const satisfies readonly TrackingEventStatus[];
export type TrackingMove = (typeof TRACKING_MOVES)[number];

/** POST /admin/shipments/:trackingId/events: a tracking update. `status` is "" until one is picked. */
export const trackingSchema = z.object({
  status: z.string().pipe(z.enum(TRACKING_MOVES, { error: "app:shipment.trackingForm.chooseMove" })),
  location: text(200),
});
export type TrackingInput = z.input<typeof trackingSchema>;
export type TrackingValues = z.output<typeof trackingSchema>;

/**
 * The same endpoint with status "cancelled". The backend has no reason field:
 * the reason goes in the event's `location`, which the timeline shows.
 */
export const cancelSchema = z.object({ reason: text(200) });
export type CancelValues = z.output<typeof cancelSchema>;

const isAttachment = (file: File) => (SHIPMENT_FILE_TYPES as readonly string[]).includes(file.type);

/**
 * POST /admin/shipments/:trackingId/files. `kind` is "" and `file` null until
 * picked; the file picker already leaves out a file these checks would refuse.
 */
export const uploadSchema = z.object({
  kind: z.string().pipe(z.enum(ATTACHMENT_KINDS, { error: "app:shipment.uploadForm.chooseKind" })),
  file: z
    .custom<File | null>((value) => value instanceof File, { error: "app:shipment.uploadForm.chooseFile" })
    .pipe(
      z
        .instanceof(File)
        .refine(isAttachment, { error: "app:shipment.uploadForm.fileType" })
        .refine((file) => file.size <= MAX_SHIPMENT_FILE_BYTES, { error: "app:shipment.uploadForm.fileSize" }),
    ),
});
export type UploadInput = z.input<typeof uploadSchema>;
export type UploadValues = z.output<typeof uploadSchema>;
