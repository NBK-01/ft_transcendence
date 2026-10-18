import type { InternalUser, Organization, Role } from "../types";

/**
 * Mock staff, roles and branches shared by the staff and organizations handlers,
 * so assigning someone to a branch shows up on the Users page too.
 * Same shapes as the backend's InternalUserDto, Role and OrganizationDto;
 * deterministic so screenshots don't change.
 */

const day = (iso: string) => `${iso}T09:00:00.000Z`;

export const ROLES: Role[] = [
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

export const ORGANIZATIONS: Organization[] = [
  {
    name: "Beirut Central",
    description: "Main hub for Lebanon, including the port warehouse",
    contactEmail: "beirut@shiptrack.example",
  },
  {
    name: "Casablanca Maârif",
    description: "Morocco operations and customs clearance",
    contactEmail: "casablanca@shiptrack.example",
  },
  { name: "Paris Oberkampf", description: "Last-mile deliveries for Paris", contactEmail: "paris@shiptrack.example" },
  { name: "Lyon Part-Dieu", description: null, contactEmail: null },
  { name: "Marseille Joliette", description: "Closed after the move to Lyon", contactEmail: null, isActive: false },
].map((org, index) => ({
  id: `00000000-0000-4000-b000-00000000000${index + 1}`,
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

export const internalUsers: InternalUser[] = STAFF.map(([name, roleName, branch, isActive, created], index) => ({
  id: `00000000-0000-4000-c000-${String(index + 1).padStart(12, "0")}`,
  email: emailOf(name),
  name,
  isActive,
  roleName,
  organizationId: branch === null ? null : ORGANIZATIONS[branch]!.id,
  createdAt: day(created),
  updatedAt: day(created),
}));

export const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
export const roleExists = (name: unknown) => ROLES.some((role) => role.name === name);
export const orgExists = (id: unknown) => ORGANIZATIONS.some((org) => org.id === id);
