import { http } from "msw/http";

import type { InternalUser, StaffChange } from "../types";
import { internalUsers, isUuid, ROLES, roleExists, staffPasswords } from "./data";
import { notifyAction, type Who } from "./notification-store";
import { error, ok } from "./respond";
import { staffCaller } from "./staff-auth";

/**
 * Staff accounts and roles for the admin app.
 *
 * The real endpoints require an admin token. `requireStaffAccess` (staff-auth.ts)
 * checks it before these handlers run.
 */

/** Backend InternalUserErrorCodes. */
const USER_NOT_FOUND = 8001;
const USER_ALREADY_EXISTS = 8002;
/** Backend AccessControlErrorCodes.RoleNotFound. */
const ROLE_NOT_FOUND = 7004;
/** Backend InternalUserErrorCodes.CannotRemoveLastAdmin. */
const CANNOT_REMOVE_LAST_ADMIN = 8007;

/** Who's acting: requireStaffAccess has already checked the token. */
const actorOf = (request: Request): Who | null => {
  const { caller } = staffCaller(request);
  return caller ? { id: caller.id, accountType: "staff" } : null;
};

const roleNotFound = (name: string) => error(404, [`Role ${name} not found`], ROLE_NOT_FOUND);

type CreateBody = Partial<{ email: string; password: string; name: string; roleName: string; organizationId: string }>;
type UpdateBody = Partial<{ name: string; roleName: string; organizationId: string | null; isActive: boolean }>;

export const staffHandlers = [
  // Unpaginated, like the real InternalUsersController.findAll.
  http.get("*/api/internal-users", () => ok(internalUsers)),

  http.post("*/api/internal-users", async ({ request }) => {
    const body = (await request.json()) as CreateBody;
    const email = body.email?.trim().toLowerCase() ?? "";
    const messages = [
      !/^\S+@\S+\.\S+$/.test(email) && "email must be an email",
      (body.password?.length ?? 0) < 8 && "password must be longer than or equal to 8 characters",
      !body.name?.trim() && "name should not be empty",
      !body.roleName?.trim() && "roleName should not be empty",
      body.organizationId !== undefined && !isUuid(body.organizationId) && "organizationId must be a UUID",
    ].filter((message): message is string => Boolean(message));
    if (messages.length > 0) return error(400, messages);
    // Same order as InternalUsersService.create. The backend doesn't check that the branch exists.
    if (internalUsers.some((user) => user.email === email)) {
      return error(409, [`A staff account with email ${email} already exists`], USER_ALREADY_EXISTS);
    }
    if (!roleExists(body.roleName)) return roleNotFound(body.roleName!);

    const now = new Date().toISOString();
    const user: InternalUser = {
      id: crypto.randomUUID(),
      email,
      name: body.name!.trim(),
      isActive: true,
      roleName: body.roleName!,
      organizationId: body.organizationId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    internalUsers.push(user);
    staffPasswords.set(user.id, body.password!);
    notifyAction({ type: "STAFF_ACCOUNT_CREATED", staff: user }, actorOf(request));
    return ok(user, 201);
  }),

  http.patch("*/api/internal-users/:id", async ({ params, request }) => {
    const user = internalUsers.find((candidate) => candidate.id === params.id);
    if (!user) return error(404, [`Staff member ${String(params.id)} not found`], USER_NOT_FOUND);

    const body = (await request.json()) as UpdateBody;
    if (body.name !== undefined && !body.name.trim()) return error(400, ["name should not be empty"]);
    if (body.roleName !== undefined && !roleExists(body.roleName)) return roleNotFound(body.roleName);

    const before = { ...user };
    Object.assign(user, {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.roleName !== undefined && { roleName: body.roleName }),
      ...(body.organizationId !== undefined && { organizationId: body.organizationId }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      updatedAt: new Date().toISOString(),
    });
    // Like the backend's subscriber: a deactivation (the other admins only), or what changed.
    if (before.isActive && !user.isActive) {
      notifyAction({ type: "STAFF_ACCOUNT_DEACTIVATED", staff: user }, actorOf(request));
    } else {
      const changed = (
        [
          [before.roleName !== user.roleName, "role"],
          [before.organizationId !== user.organizationId, "branch"],
          [before.name !== user.name, "name"],
          [!before.isActive && user.isActive, "reactivated"],
        ] as const
      )
        .filter(([didChange]) => didChange)
        .map(([, change]): StaffChange => change);
      if (changed.length > 0) notifyAction({ type: "STAFF_ACCOUNT_UPDATED", staff: user, changed }, actorOf(request));
    }
    return ok(user);
  }),

  // Permanent, distinct from PATCH isActive: false. Refuses the last active admin.
  http.delete("*/api/internal-users/:id", ({ params }) => {
    const index = internalUsers.findIndex((candidate) => candidate.id === params.id);
    if (index === -1) return error(404, [`Staff member ${String(params.id)} not found`], USER_NOT_FOUND);
    const user = internalUsers[index]!;
    if (user.roleName === "admin" && user.isActive) {
      const otherActiveAdmins = internalUsers.filter(
        (candidate) => candidate.roleName === "admin" && candidate.isActive,
      );
      if (otherActiveAdmins.every((admin) => admin.id === user.id)) {
        return error(409, ["Cannot remove the last admin"], CANNOT_REMOVE_LAST_ADMIN);
      }
    }
    internalUsers.splice(index, 1);
    return ok({ message: "Staff account deleted" });
  }),

  http.get("*/api/access-control/roles", () => ok(ROLES)),
];
