import { z } from "zod";

/**
 * Profile form (client app). Error messages are i18n keys, rendered by <Field>.
 * Matches the proposed PATCH /users/profile body; empty optional fields are ""
 * here and null in the API. The backend must check the same rules again.
 */

const name = z.string().trim().min(1, { error: "validation.required" }).max(50, { error: "validation.nameMax" });

/** "YYYY-MM-DD" from a date input: a real calendar date, after 1900 and not in the future. */
export function isValidBirthDate(value: string, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real && year >= 1900 && date <= today;
}

/** An international number: a leading "+", then 7 to 15 digits (the E.164 maximum), with spaces, dashes, dots or brackets between. */
export function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^\+[\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
}

export const profileSchema = z.object({
  firstName: name,
  lastName: name,
  dateOfBirth: z.string().refine((value) => !value || isValidBirthDate(value), { error: "validation.dateOfBirth" }),
  phoneNumber: z
    .string()
    .trim()
    .refine((value) => !value || isValidPhone(value), { error: "validation.phone" }),
});
export type ProfileValues = z.infer<typeof profileSchema>;
