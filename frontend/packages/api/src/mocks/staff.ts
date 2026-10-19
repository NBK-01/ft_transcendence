import { http } from "msw/http";

import type { InternalUser } from "../types";
import { internalUsers, isUuid, orgExists, ROLES, roleExists } from "./data";
import { error, ok } from "./respond";

/**
 * Staff accounts and roles for the admin app.
 *
 * The real endpoints require an admin (or staff) token. These don't check one
 * yet, because the admin app has no staff login wired.
 */

/** Backend InternalUserErrorCodes. */
const USER_NOT_FOUND = 8001;
const USER_ALREADY_EXISTS = 8002;

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
      !roleExists(body.roleName) && "roleName must be an existing role",
      body.organizationId !== undefined && !isUuid(body.organizationId) && "organizationId must be a UUID",
    ].filter((message): message is string => Boolean(message));
    if (messages.length > 0) return error(400, messages);
    if (body.organizationId && !orgExists(body.organizationId)) return error(404, ["Organization not found"]);
    if (internalUsers.some((user) => user.email === email)) {
      return error(409, [`A staff account with email ${email} already exists`], USER_ALREADY_EXISTS);
    }

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
    return ok(user, 201);
  }),

  http.patch("*/api/internal-users/:id", async ({ params, request }) => {
    const user = internalUsers.find((candidate) => candidate.id === params.id);
    if (!user) return error(404, [`Staff member ${String(params.id)} not found`], USER_NOT_FOUND);

    const body = (await request.json()) as UpdateBody;
    if (body.name !== undefined && !body.name.trim()) return error(400, ["name should not be empty"]);
    if (body.roleName !== undefined && !roleExists(body.roleName)) return error(400, ["roleName must be an existing role"]);
    if (body.organizationId && !orgExists(body.organizationId)) return error(404, ["Organization not found"]);

    Object.assign(user, {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.roleName !== undefined && { roleName: body.roleName }),
      ...(body.organizationId !== undefined && { organizationId: body.organizationId }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      updatedAt: new Date().toISOString(),
    });
    return ok(user);
  }),

  http.get("*/api/access-control/roles", () => ok(ROLES)),
];
