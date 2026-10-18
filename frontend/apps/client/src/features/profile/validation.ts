/**
 * Profile checks, run in the browser before saving. Error values are i18n keys
 * (the shared Field translates them), like the auth forms' zod schemas.
 * The backend must check the same rules again: never trust the client.
 */

/** Same limits as the backend's FileStorageService for avatars. */
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function avatarError(file: File): string | undefined {
  if (!AVATAR_TYPES.includes(file.type)) return "app:profile.errors.avatarType";
  if (file.size > AVATAR_MAX_BYTES) return "app:profile.errors.avatarSize";
  return undefined;
}

/** Shared rules: required, 50 characters max (validation.* keys in the common strings). */
export function nameError(value: string): string | undefined {
  const name = value.trim();
  if (!name) return "validation.required";
  if (name.length > 50) return "validation.nameMax";
  return undefined;
}

/** "YYYY-MM-DD" from the date input. Optional, but if given: a real date, in the past, after 1900. */
export function dateOfBirthError(value: string, today = new Date()): string | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "app:profile.errors.dateOfBirth";
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!real || year < 1900 || date > today) return "app:profile.errors.dateOfBirth";
  return undefined;
}

/**
 * Optional, but if given: an international number. A leading "+", then 7 to 15
 * digits (the E.164 maximum), with spaces, dashes, dots or brackets allowed between.
 */
export function phoneError(value: string): string | undefined {
  const phone = value.trim();
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (!/^\+[\d\s().-]+$/.test(phone) || digits.length < 7 || digits.length > 15) return "app:profile.errors.phone";
  return undefined;
}
