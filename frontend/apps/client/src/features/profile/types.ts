/**
 * GET /users/profile (backend UserDto).
 *
 * Real today: id, email, name, isVerified, avatarUrl, createdAt, updatedAt.
 * Proposed, mocked until the backend adds them: firstName, lastName,
 * dateOfBirth, phoneNumber. They're optional so the page still works
 * against the real endpoint, which doesn't send them yet.
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

/** PATCH /users/profile body (proposed). Email isn't editable here. */
export type ProfileUpdate = {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phoneNumber: string | null;
};

/** POST /users/profile/avatar response (real). */
export type AvatarUploadResult = { avatarUrl: string };
