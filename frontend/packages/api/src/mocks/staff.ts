import { http } from "msw/http";

import type { InternalUser, Organization, Role } from "../types";
import { error, ok } from "./respond";

/**
 * Staff, roles and branches for the admin app. Same shapes as the backend's
 * InternalUserDto, Role and OrganizationDto; deterministic so screenshots don't change.
 *
 * The real endpoints require an admin (or staff) token. These don't check one
 * yet, because the admin app has no staff login wired.
 */

const day = (iso: string) => `${iso}T09:00:00.000Z`;

const ROLES: Role[] = [
  { name: "admin", description: "Full access to every branch and setting" },
  { name: "dispatcher", description: "Assigns and tracks shipments for a branch" },
  { name: "driver", description: "Picks up and delivers assigned shipments" },
  { name: "support", description: "Answers customer messages" },
].map((role, index) => ({
  id: `00000000-0000-4000-a000-00000000000${index + 1}`,
  ...role,
  createdAt: day("2026-09-01"),
  updatedAt: day("2026-09-01"),
}));

const ORGANIZATIONS: Organization[] = [
  { name: "Beirut Central", contactEmail: "beirut@shiptrack.example" },
  { name: "Casablanca Maârif", contactEmail: "casablanca@shiptrack.example" },
  { name: "Paris Oberkampf", contactEmail: "paris@shiptrack.example" },
  { name: "Lyon Part-Dieu", contactEmail: null },
].map((org, index) => ({
  id: `00000000-0000-4000-b000-00000000000${index + 1}`,
  description: null,
  isActive: true,
  createdAt: day("2026-09-02"),
  updatedAt: day("2026-09-02"),
  ...org,
}));

/** [name, role, branch index or null, active, created] */
const STAFF: [string, string | null, number | null, boolean, string][] = [
  ["Nadia Haddad", "admin", null, true, "2026-09-03"],
  ["Youssef Benali", "admin", null, true, "2026-09-03"],
  ["Rami Khoury", "dispatcher", 0, true, "2026-09-05"],
  ["Salma Tazi", "dispatcher", 1, true, "2026-09-05"],
  ["Claire Martin", "dispatcher", 2, true, "2026-09-06"],
  ["Hugo Bernard", "dispatcher", 3, false, "2026-09-06"],
  ["Karim Saade", "driver", 0, true, "2026-09-08"],
  ["Elie Nassar", "driver", 0, true, "2026-09-08"],
  ["Omar Fassi", "driver", 1, true, "2026-09-09"],
  ["Imane Alaoui", "driver", 1, true, "2026-09-09"],
  ["Mehdi Chraibi", "driver", 1, false, "2026-09-10"],
  ["Lucas Petit", "driver", 2, true, "2026-09-11"],
  ["Inès Moreau", "driver", 2, true, "2026-09-11"],
  ["Théo Laurent", "driver", 3, true, "2026-09-12"],
  ["Léa Girard", "driver", 3, true, "2026-09-12"],
  ["Maya Azar", "support", 0, true, "2026-09-15"],
  ["Hiba Mansour", "support", 0, true, "2026-09-15"],
  ["Zineb Idrissi", "support", 1, true, "2026-09-16"],
  ["Camille Roux", "support", 2, true, "2026-09-17"],
  ["Julien Faure", "support", 2, false, "2026-09-18"],
  ["Sami Hajj", "driver", 0, true, "2026-10-01"],
  ["Anas Berrada", "dispatcher", 1, true, "2026-10-04"],
  ["Emma Dubois", "support", 3, true, "2026-10-09"],
  ["Tarek Jaber", null, null, true, "2026-10-14"],
];

const emailOf = (name: string) =>
  `${name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, ".")}@shiptrack.example`;

const internalUsers: InternalUser[] = STAFF.map(([name, roleName, branch, isActive, created], index) => ({
  id: `00000000-0000-4000-c000-${String(index + 1).padStart(12, "0")}`,
  email: emailOf(name),
  name,
  isActive,
  roleName,
  organizationId: branch === null ? null : ORGANIZATIONS[branch]!.id,
  createdAt: day(created),
  updatedAt: day(created),
}));

/** Backend InternalUserErrorCodes. */
const USER_NOT_FOUND = 8001;
const USER_ALREADY_EXISTS = 8002;

const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
const roleExists = (name: unknown) => ROLES.some((role) => role.name === name);
const orgExists = (id: unknown) => ORGANIZATIONS.some((org) => org.id === id);

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
  http.get("*/api/organizations", () => ok(ORGANIZATIONS)),
];
