import { http } from "msw/http";

import { ROLE_PERMISSIONS, type StaffRole } from "../permissions";
import type { InternalUser, StaffAvatarResult, StaffMe, StaffProfile } from "../types";
import { internalUsers, isUuid, ORGANIZATIONS } from "./data";
import { areConnected } from "./contacts";
import { notifyAction } from "./notification-store";
import { isOnline } from "./presence";
import { error, ok } from "./respond";
import { staffCaller } from "./staff-auth";

/**
 * GET /staff-auth/me and StaffProfileController: a staff member's own name
 * and photo, and colleagues' pages. Photos live here, in memory, as blob URLs.
 */

/** Backend InternalUserErrorCodes / FileStorageErrorCodes. */
const USER_NOT_FOUND = 8001;
const INVALID_FILE_TYPE = 9001;
const FILE_TOO_LARGE = 9002;
const MISSING_REQUIRED_DATA = 5001;

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const avatars = new Map<string, string>();

/** A staff member's photo, for the other mocks that show one (contacts). */
export const staffAvatarOf = (id: string) => avatars.get(id) ?? null;

const branchOf = (user: InternalUser) => ORGANIZATIONS.find((org) => org.id === user.organizationId);

/** StaffProfileService.me: the account as it is now, with its branch and its role's permissions. */
function meOf(user: InternalUser): StaffMe {
  const branch = branchOf(user);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleName: user.roleName,
    organizationId: user.organizationId,
    organization: branch ? { id: branch.id, name: branch.name, isActive: branch.isActive } : null,
    avatarUrl: staffAvatarOf(user.id),
    permissions:
      user.roleName && Object.hasOwn(ROLE_PERMISSIONS, user.roleName)
        ? [...ROLE_PERMISSIONS[user.roleName as StaffRole]]
        : [],
  };
}

const told = (user: InternalUser, change: "details" | "avatar") => {
  const account = { id: user.id, accountType: "staff" as const };
  notifyAction({ type: "PROFILE_UPDATED", account, change }, account);
};

export const staffProfileHandlers = [
  http.get("*/api/staff-auth/me", ({ request }) => {
    const { caller, response } = staffCaller(request);
    return caller ? ok(meOf(caller)) : response;
  }),

  // UpdateStaffProfileDto: a trimmed name, 1–100 characters, and nothing else.
  http.patch("*/api/staff-profile", async ({ request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const extra = Object.keys(body).filter((field) => field !== "name");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const problems = [
      ...extra.map((field) => `property ${field} should not exist`),
      ...(name === "" ? ["name should not be empty"] : []),
      ...(name.length > 100 ? ["name must be shorter than or equal to 100 characters"] : []),
    ];
    if (problems.length > 0) return error(400, problems);
    if (name !== caller.name) {
      Object.assign(caller, { name, updatedAt: new Date().toISOString() });
      told(caller, "details");
    }
    return ok(meOf(caller));
  }),

  // FileStorageService.uploadAvatar's rules; the old photo goes.
  http.post("*/api/staff-profile/avatar", async ({ request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;
    const file = (await request.formData().catch(() => new FormData())).get("file");
    if (!(file instanceof File)) return error(400, ["file is required"], MISSING_REQUIRED_DATA);
    if (!AVATAR_TYPES.includes(file.type)) {
      return error(400, [`File type not allowed. Accepted types: ${AVATAR_TYPES.join(", ")}`], INVALID_FILE_TYPE);
    }
    if (file.size > AVATAR_MAX_BYTES) return error(400, ["File exceeds the maximum size of 2MB"], FILE_TOO_LARGE);
    const previous = avatars.get(caller.id);
    if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
    const avatarUrl = URL.createObjectURL(file);
    avatars.set(caller.id, avatarUrl);
    told(caller, "avatar");
    return ok<StaffAvatarResult>({ avatarUrl }, 201);
  }),

  http.delete("*/api/staff-profile/avatar", ({ request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;
    const previous = avatars.get(caller.id);
    if (previous) {
      if (previous.startsWith("blob:")) URL.revokeObjectURL(previous);
      avatars.delete(caller.id);
      told(caller, "avatar");
    }
    return ok<StaffAvatarResult>({ avatarUrl: null });
  }),

  http.get("*/api/staff-profile/:id", ({ params, request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;
    if (!isUuid(params.id)) return error(400, ["Validation failed (uuid is expected)"]);
    const user = internalUsers.find((candidate) => candidate.id === params.id);
    if (!user) return error(404, [`Internal user ${String(params.id)} not found`], USER_NOT_FOUND);
    const branch = branchOf(user);
    return ok<StaffProfile>({
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.roleName,
      organization: branch ? { id: branch.id, name: branch.name } : null,
      avatarUrl: staffAvatarOf(user.id),
      isActive: user.isActive,
      // Only contacts see it (and you see yourself).
      online: user.id === caller.id ? true : areConnected(caller.id, user.id) ? isOnline(user.id) : null,
      createdAt: user.createdAt,
    });
  }),
];
