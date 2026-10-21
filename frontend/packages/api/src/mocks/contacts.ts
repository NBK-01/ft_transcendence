import { http } from "msw/http";

import type { Contact, ContactStatus, InternalUser, MessageResponse } from "../types";
import { internalUsers, isUuid } from "./data";
import { error, ok } from "./respond";
import { staffCaller } from "./staff-auth";

/**
 * Staff contacts (backend ContactsController, @RequireStaff on every route;
 * `requireStaffAccess` checks the token first). Same rules and order as
 * ContactsService: you can add someone in your own branch, or anyone if either
 * of you is an admin; only the addressee accepts or rejects; either side
 * blocks or removes. Rejecting or removing deletes the contact.
 */

/** Backend ContactErrorCodes. */
const CONTACT_NOT_FOUND = 10001;
const CONTACT_ALREADY_EXISTS = 10002;
const CONTACT_SCOPE_VIOLATION = 10003;
const CONTACT_SELF_REQUEST = 10004;
const CONTACT_NOT_PENDING = 10005;

const STATUSES: ContactStatus[] = ["pending", "accepted", "blocked"];

const byName = (name: string) => internalUsers.find((user) => user.name === name)!;

type Row = { id: string; requesterId: string; addresseeId: string; status: ContactStatus; createdAt: string; updatedAt: string };

/** [requester, addressee, status, created]: something in every tab for Nadia (admin) and Rami (dispatcher). */
const SEED: [string, string, ContactStatus, string][] = [
  ["Nadia Haddad", "Rami Khoury", "accepted", "2026-10-02"],
  ["Nadia Haddad", "Youssef Benali", "accepted", "2026-10-02"],
  ["Salma Tazi", "Nadia Haddad", "accepted", "2026-10-05"],
  ["Maya Azar", "Nadia Haddad", "pending", "2026-10-18"],
  ["Nadia Haddad", "Claire Martin", "pending", "2026-10-19"],
  ["Karim Saade", "Rami Khoury", "pending", "2026-10-17"],
  ["Rami Khoury", "Elie Nassar", "pending", "2026-10-20"],
  ["Rami Khoury", "Sami Hajj", "blocked", "2026-10-08"],
];

const contacts: Row[] = SEED.map(([requester, addressee, status, created], index) => ({
  id: `00000000-0000-4000-d000-${String(index + 1).padStart(12, "0")}`,
  requesterId: byName(requester).id,
  addresseeId: byName(addressee).id,
  status,
  createdAt: `${created}T09:00:00.000Z`,
  updatedAt: `${created}T09:00:00.000Z`,
}));

/** Like ContactFactory: both people's names and emails, as they are now. */
const toDto = (row: Row): Contact => {
  const requester = internalUsers.find((user) => user.id === row.requesterId)!;
  const addressee = internalUsers.find((user) => user.id === row.addresseeId)!;
  return {
    ...row,
    requesterName: requester.name,
    requesterEmail: requester.email,
    addresseeName: addressee.name,
    addresseeEmail: addressee.email,
  };
};

const notFound = (id: unknown) => error(404, [`Contact ${String(id)} not found`], CONTACT_NOT_FOUND);
const isParty = (row: Row, actorId: string) => row.requesterId === actorId || row.addresseeId === actorId;
const sameBranch = (a: InternalUser, b: InternalUser) => a.organizationId !== null && a.organizationId === b.organizationId;

/** getPendingRequestOrThrow + assertIsAddressee, in the backend's order. */
const pendingForAddressee = (id: unknown, actorId: string) => {
  const row = contacts.find((candidate) => candidate.id === id);
  if (!row) return { response: notFound(id) };
  if (row.status !== "pending") {
    return { response: error(409, ["This contact request is no longer pending"], CONTACT_NOT_PENDING) };
  }
  // Not found rather than forbidden: a contact you aren't party to doesn't confirm it exists.
  if (row.addresseeId !== actorId) return { response: notFound(id) };
  return { row };
};

/** getContactOrThrow + assertIsParty. */
const partyContact = (id: unknown, actorId: string) => {
  const row = contacts.find((candidate) => candidate.id === id);
  if (!row || !isParty(row, actorId)) return { response: notFound(id) };
  return { row };
};

export const contactHandlers = [
  http.get("*/api/contacts", ({ request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;
    const status = new URL(request.url).searchParams.get("status");
    if (status && !STATUSES.includes(status as ContactStatus)) {
      return error(400, [`status must be one of the following values: ${STATUSES.join(", ")}`]);
    }
    return ok(
      contacts.filter((row) => isParty(row, caller.id) && (!status || row.status === status)).map(toDto),
    );
  }),

  http.post("*/api/contacts", async ({ request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;
    const { addresseeId } = (await request.json()) as { addresseeId?: string };
    if (!isUuid(addresseeId)) return error(400, ["addresseeId must be a UUID"]);
    if (addresseeId === caller.id) return error(400, ["You cannot add yourself as a contact"], CONTACT_SELF_REQUEST);

    const addressee = internalUsers.find((user) => user.id === addresseeId);
    const admin = caller.roleName === "admin" || addressee?.roleName === "admin";
    if (!addressee || !(sameBranch(caller, addressee) || admin)) {
      return error(403, ["You can only add contacts within your own organization"], CONTACT_SCOPE_VIOLATION);
    }
    if (contacts.some((row) => isParty(row, caller.id) && isParty(row, addressee.id))) {
      return error(409, ["A contact request already exists between these two staff members"], CONTACT_ALREADY_EXISTS);
    }

    const now = new Date().toISOString();
    const row: Row = {
      id: crypto.randomUUID(),
      requesterId: caller.id,
      addresseeId: addressee.id,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    contacts.push(row);
    return ok(toDto(row), 201);
  }),

  http.patch("*/api/contacts/:id/accept", ({ params, request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;
    const found = pendingForAddressee(params.id, caller.id);
    if (!found.row) return found.response;
    Object.assign(found.row, { status: "accepted", updatedAt: new Date().toISOString() });
    return ok(toDto(found.row));
  }),

  http.patch("*/api/contacts/:id/reject", ({ params, request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;
    const found = pendingForAddressee(params.id, caller.id);
    if (!found.row) return found.response;
    contacts.splice(contacts.indexOf(found.row), 1);
    return ok<MessageResponse>({ message: "Contact request rejected" });
  }),

  http.patch("*/api/contacts/:id/block", ({ params, request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;
    const found = partyContact(params.id, caller.id);
    if (!found.row) return found.response;
    Object.assign(found.row, { status: "blocked", updatedAt: new Date().toISOString() });
    return ok(toDto(found.row));
  }),

  http.delete("*/api/contacts/:id", ({ params, request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;
    const found = partyContact(params.id, caller.id);
    if (!found.row) return found.response;
    contacts.splice(contacts.indexOf(found.row), 1);
    return ok<MessageResponse>({ message: "Contact removed" });
  }),
];
