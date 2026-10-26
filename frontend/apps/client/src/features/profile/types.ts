/**
 * GET /users/profile (backend UserDto).
 *
 * Real: id, email, name, isVerified, avatarUrl, createdAt, updatedAt,
 * firstName, lastName, dateOfBirth, phoneNumber. The latter four stay
 * optional since existing accounts may not have filled them in yet.
 */
export type Profile = {
  id: string;
  email: string;
  /** Full name, the only name the backend stores today ("Amina El Idrissi"). */
  name: string;
  isVerified: boolean;
  /** Signed URL, regenerated on each read; null when no photo was uploaded. */
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  firstName?: string | null;
  lastName?: string | null;
  /** Calendar date, "YYYY-MM-DD" (no time, no time zone). */
  dateOfBirth?: string | null;
  /** International format, e.g. "+961 70 123 456". */
  phoneNumber?: string | null;
};

/** PATCH /users/profile body (real endpoint). Email isn't editable here. */
export type ProfileUpdate = {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phoneNumber: string | null;
};

/** POST /users/profile/avatar response (real). */
export type AvatarUploadResult = { avatarUrl: string };
