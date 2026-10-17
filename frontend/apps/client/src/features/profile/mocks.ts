import { http } from "msw/http";

import { error, ok } from "@trans/api/mocks";

import type { AvatarUploadResult, Profile, ProfileUpdate } from "./types";
import { AVATAR_MAX_BYTES, AVATAR_TYPES, dateOfBirthError, nameError, phoneError } from "./validation";

/**
 * Mock profile endpoints (VITE_API_MOCKS=true), enveloped like the real API.
 * In memory: changes stick until the page reloads.
 *
 * GET /users/profile and POST /users/profile/avatar exist in the backend; these
 * copies add the proposed fields. PATCH /users/profile is proposed: delete its
 * handler once it ships. Same rules as the real avatar upload (JPEG/PNG/WebP,
 * 2 MB, error codes 9001/9002).
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

/** A 400 like the backend's validation errors, naming the field that failed. */
const invalid = (field: string) => error(400, [`${field} is invalid`]);

export const profileHandlers = [
  http.get("*/api/users/profile", () => ok<Profile>(profile)),

  http.patch("*/api/users/profile", async ({ request }) => {
    const body = (await request.json()) as Partial<ProfileUpdate>;
    const firstName = body.firstName?.trim() ?? "";
    const lastName = body.lastName?.trim() ?? "";
    const dateOfBirth = body.dateOfBirth || null;
    const phoneNumber = body.phoneNumber?.trim() || null;

    if (nameError(firstName)) return invalid("firstName");
    if (nameError(lastName)) return invalid("lastName");
    if (dateOfBirth && dateOfBirthError(dateOfBirth)) return invalid("dateOfBirth");
    if (phoneNumber && phoneError(phoneNumber)) return invalid("phoneNumber");

    Object.assign(profile, {
      firstName,
      lastName,
      // Keep the existing `name` in step, as the backend would.
      name: `${firstName} ${lastName}`,
      dateOfBirth,
      phoneNumber,
      updatedAt: new Date().toISOString(),
    });
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
    return ok<AvatarUploadResult>({ avatarUrl: profile.avatarUrl }, 201);
  }),
];
