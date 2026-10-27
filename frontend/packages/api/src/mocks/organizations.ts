import { http } from "msw/http";

import type { Organization } from "../types";
import { apiKeyCountOf } from "./api-keys";
import { internalUsers, isUuid, ORGANIZATIONS } from "./data";
import { notifyAction, type Who } from "./notification-store";
import { error, ok } from "./respond";
import { mockShipments } from "./shipments";
import { staffCaller } from "./staff-auth";

/**
 * Branches (backend OrganizationsController). Writes need `organizations:manage`,
 * reads any staff token. `requireStaffAccess` (staff-auth.ts) checks both
 * before these handlers run.
 */

/** Backend OrganizationErrorCodes. */
const ORGANIZATION_NOT_FOUND = 4001;
const ORGANIZATION_ALREADY_EXISTS = 4002;
const ORGANIZATION_IN_USE = 4003;
const STAFF_NOT_IN_ORGANIZATION = 4004;
/** Backend InternalUserErrorCodes. */
const USER_NOT_FOUND = 8001;

type Body = Partial<{ name: string; description: string | null; contactEmail: string | null; isActive: boolean }>;

const notFound = (id: unknown) =>
  error(404, [`Organization ${String(id)} not found`], ORGANIZATION_NOT_FOUND);

/** Who's acting: requireStaffAccess has already checked the token. */
const actorOf = (request: Request): Who | null => {
  const { caller } = staffCaller(request);
  return caller ? { id: caller.id, accountType: "staff" } : null;
};

/** ParseUUIDPipe on every :id: a 400 before anything is looked up. */
const badIds = (...ids: unknown[]) =>
  ids.some((id) => !isUuid(String(id))) ? error(400, ["Validation failed (uuid is expected)"]) : null;

/** What still points at a branch: deleting it would orphan or delete these. */
const inUse = (organizationId: string) =>
  internalUsers.some((user) => user.organizationId === organizationId) ||
  mockShipments().some((shipment) => shipment.organization?.id === organizationId) ||
  apiKeyCountOf(organizationId) > 0;

const nameTaken = (name: string, exceptId?: string) =>
  ORGANIZATIONS.some((org) => org.name === name && org.id !== exceptId);

/** class-validator: @IsEmail() on an optional field still rejects "". */
const invalidEmail = (value: unknown) =>
  value !== undefined && value !== null && !/^\S+@\S+\.\S+$/.test(String(value));

export const organizationHandlers = [
  http.get("*/api/organizations", () => ok(ORGANIZATIONS)),

  http.get("*/api/organizations/:id", ({ params }) => {
    const org = ORGANIZATIONS.find((candidate) => candidate.id === params.id);
    return org ? ok(org) : notFound(params.id);
  }),

  http.post("*/api/organizations", async ({ request }) => {
    const body = (await request.json()) as Body;
    const name = body.name?.trim() ?? "";
    const messages = [
      !name && "name should not be empty",
      invalidEmail(body.contactEmail) && "contactEmail must be an email",
    ].filter((message): message is string => Boolean(message));
    if (messages.length > 0) return error(400, messages);
    if (nameTaken(name)) {
      return error(409, [`Organization ${name} already exists`], ORGANIZATION_ALREADY_EXISTS);
    }

    const now = new Date().toISOString();
    const org: Organization = {
      id: crypto.randomUUID(),
      name,
      description: body.description ?? null,
      contactEmail: body.contactEmail ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    ORGANIZATIONS.push(org);
    notifyAction({ type: "BRANCH_CREATED", organization: org }, actorOf(request));
    return ok(org, 201);
  }),

  http.patch("*/api/organizations/:id", async ({ params, request }) => {
    const org = ORGANIZATIONS.find((candidate) => candidate.id === params.id);
    if (!org) return notFound(params.id);

    const body = (await request.json()) as Body;
    if (invalidEmail(body.contactEmail)) return error(400, ["contactEmail must be an email"]);
    // The real update doesn't check this yet (the unique column fails instead); mocked as it should behave.
    if (body.name !== undefined && nameTaken(body.name.trim(), org.id)) {
      return error(409, [`Organization ${body.name.trim()} already exists`], ORGANIZATION_ALREADY_EXISTS);
    }

    const before = { ...org };
    Object.assign(org, {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      updatedAt: new Date().toISOString(),
    });
    // Like the backend's subscriber: a deactivation, or a real change (a reactivation included).
    const deactivated = before.isActive && !org.isActive;
    const changed =
      before.name !== org.name ||
      before.description !== org.description ||
      before.contactEmail !== org.contactEmail ||
      (!before.isActive && org.isActive);
    if (deactivated || changed) {
      notifyAction({ type: deactivated ? "BRANCH_DEACTIVATED" : "BRANCH_UPDATED", organization: org }, actorOf(request));
    }
    return ok(org);
  }),

  // A real delete, only for a branch nothing points at; deactivating is PATCH isActive false.
  http.delete("*/api/organizations/:id", ({ params, request }) => {
    const invalid = badIds(params.id);
    if (invalid) return invalid;
    const org = ORGANIZATIONS.find((candidate) => candidate.id === params.id);
    if (!org) return notFound(params.id);
    if (inUse(org.id)) {
      return error(409, [`${org.name} still has staff, shipments or API keys. Deactivate it instead.`], ORGANIZATION_IN_USE);
    }
    ORGANIZATIONS.splice(ORGANIZATIONS.indexOf(org), 1);
    notifyAction({ type: "BRANCH_DELETED", organization: org }, actorOf(request));
    return ok({ message: "Organization deleted" });
  }),

  http.get("*/api/organizations/:id/staff", ({ params }) => {
    if (!ORGANIZATIONS.some((org) => org.id === params.id)) return notFound(params.id);
    return ok(internalUsers.filter((user) => user.organizationId === params.id));
  }),

  // Moves the staff member: they leave whatever branch they were in (and are told). Already there: nothing changes.
  http.post("*/api/organizations/:id/staff/:userId", ({ params, request }) => {
    const invalid = badIds(params.id, params.userId);
    if (invalid) return invalid;
    const org = ORGANIZATIONS.find((candidate) => candidate.id === params.id);
    if (!org) return notFound(params.id);
    const user = internalUsers.find((candidate) => candidate.id === params.userId);
    if (!user) return error(404, [`Staff member ${String(params.userId)} not found`], USER_NOT_FOUND);
    if (user.organizationId === org.id) return ok({ message: "Staff member assigned" });
    const previous = ORGANIZATIONS.find((candidate) => candidate.id === user.organizationId);
    Object.assign(user, { organizationId: org.id, updatedAt: new Date().toISOString() });
    if (previous) notifyAction({ type: "BRANCH_STAFF_REMOVED", organization: previous, staffId: user.id }, actorOf(request));
    notifyAction({ type: "BRANCH_STAFF_ADDED", organization: org, staffId: user.id }, actorOf(request));
    return ok({ message: "Staff member assigned" });
  }),

  // Only from the branch they're in: anyone else is a 404 (4004).
  http.delete("*/api/organizations/:id/staff/:userId", ({ params, request }) => {
    const invalid = badIds(params.id, params.userId);
    if (invalid) return invalid;
    const branch = ORGANIZATIONS.find((org) => org.id === params.id);
    if (!branch) return notFound(params.id);
    const user = internalUsers.find((candidate) => candidate.id === params.userId);
    if (!user) return error(404, [`Staff member ${String(params.userId)} not found`], USER_NOT_FOUND);
    if (user.organizationId !== branch.id) {
      return error(404, [`Staff member ${user.id} isn't in this organization`], STAFF_NOT_IN_ORGANIZATION);
    }
    Object.assign(user, { organizationId: null, updatedAt: new Date().toISOString() });
    notifyAction({ type: "BRANCH_STAFF_REMOVED", organization: branch, staffId: user.id }, actorOf(request));
    return ok({ message: "Staff member removed" });
  }),
];
