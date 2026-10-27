import { http } from "msw/http";

import { error, notifyAction, ok } from "@trans/api/mocks";
import { profileSchema } from "@trans/ui/schemas/profile";

import type { AvatarUploadResult, Profile, ProfileUpdate } from "./types";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "./validation";

/**
 * Mock profile endpoints (VITE_API_MOCKS=true), enveloped like the real API.
 * In memory: changes stick until the page reloads.
 *
 * GET /users/profile, PATCH /users/profile and POST /users/profile/avatar all
 * mirror real backend endpoints now. Same rules as the real avatar upload
 * (JPEG/PNG/WebP, 2 MB, error codes 9001/9002).
 */

const profile: Profile = {
  id: "8f0c1d2e-0000-4000-8000-000000000001",
  email: "amina@example.com",
  name: "Amina El Idrissi",
  isVerified: true,
  avatarUrl: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
  firstName: "Amina",
  lastName: "El Idrissi",
  dateOfBirth: "1998-04-12",
  phoneNumber: "+961 70 123 456",
};

/** The customer, as the notifications see them. */
const me = { id: profile.id, accountType: "customer" as const };

export const handlers = [
  http.get("*/api/users/profile", () => ok<Profile>(profile)),

  http.patch("*/api/users/profile", async ({ request }) => {
    const body = (await request.json()) as Partial<ProfileUpdate>;
    // Same rules as the form; a 400 names the fields that failed, like the backend's validation errors.
    const parsed = profileSchema.safeParse({
      firstName: body.firstName ?? "",
      lastName: body.lastName ?? "",
      dateOfBirth: body.dateOfBirth ?? "",
      phoneNumber: body.phoneNumber ?? "",
    });
    if (!parsed.success) {
      return error(400, [...new Set(parsed.error.issues.map((issue) => `${String(issue.path[0])} is invalid`))]);
    }
    const { firstName, lastName } = parsed.data;
    const dateOfBirth = parsed.data.dateOfBirth || null;
    const phoneNumber = parsed.data.phoneNumber || null;
    const changed =
      firstName !== profile.firstName ||
      lastName !== profile.lastName ||
      dateOfBirth !== profile.dateOfBirth ||
      phoneNumber !== profile.phoneNumber;

    Object.assign(profile, {
      firstName,
      lastName,
      // Keep the existing `name` in step, as the backend would.
      name: `${firstName} ${lastName}`,
      dateOfBirth,
      phoneNumber,
      updatedAt: new Date().toISOString(),
    });
    // Like the backend: only a real change is told (a record for the customer).
    if (changed) notifyAction({ type: "PROFILE_UPDATED", account: me, change: "details" }, me);
    return ok<Profile>(profile);
  }),

  http.post("*/api/users/profile/avatar", async ({ request }) => {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return error(400, ["file should not be empty"]);
    if (!AVATAR_TYPES.includes(file.type)) {
      return error(400, [`File type not allowed. Accepted types: ${AVATAR_TYPES.join(", ")}`], 9001);
    }
    if (file.size > AVATAR_MAX_BYTES) return error(400, ["File exceeds the maximum size of 2MB"], 9002);

    if (profile.avatarUrl?.startsWith("blob:")) URL.revokeObjectURL(profile.avatarUrl);
    profile.avatarUrl = URL.createObjectURL(file);
    profile.updatedAt = new Date().toISOString();
    notifyAction({ type: "PROFILE_UPDATED", account: me, change: "avatar" }, me);
    return ok<AvatarUploadResult>({ avatarUrl: profile.avatarUrl }, 201);
  }),
];
