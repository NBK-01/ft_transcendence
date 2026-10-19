/**
 * Avatar checks, run in the browser before uploading. Error values are i18n keys
 * (the shared Field translates them). The form fields use profileSchema from
 * @trans/ui/schemas/profile. The backend checks the same rules again.
 */

/** Same limits as the backend's FileStorageService for avatars. */
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function avatarError(file: File): string | undefined {
  if (!AVATAR_TYPES.includes(file.type)) return "app:profile.errors.avatarType";
  if (file.size > AVATAR_MAX_BYTES) return "app:profile.errors.avatarSize";
  return undefined;
}
