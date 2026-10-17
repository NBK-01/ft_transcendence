/** Admin-only strings (namespace "app"). Shared strings live in @trans/ui (namespace "common"). */
const en = {
  logoLabel: "Admin",
  groups: {
    operations: "Operations",
    manage: "Manage",
  },
  pages: {
    dashboard: "Live view of shipments, branches and staff.",
    shipments: "Every shipment across the branches you can access.",
    messages: "Conversations between staff and customers.",
    users: "Staff accounts: roles, branches and who can sign in.",
    branches: "Branches are organizations: members, address and shipments.",
    apiKeys: "Keys that let partner systems use the public API.",
    profile: "Your account details.",
  },
  users: {
    columns: { name: "Name", role: "Role", branch: "Branch", status: "Status", created: "Created" },
    roles: { admin: "Admin", dispatcher: "Dispatcher", driver: "Driver", support: "Support", none: "No role" },
    status: { active: "Active", deactivated: "Deactivated" },
    noBranch: "No branch",
    search: "Search name or email…",
    emptyTitle: "No staff accounts yet",
    emptyBody: "Staff accounts you create will appear here.",
    newAccount: "New staff account",
    rowActions: "Actions for {{name}}",
    edit: "Edit",
    form: {
      createTitle: "New staff account",
      createDescription: "They sign in to the admin app with this email and password.",
      editTitle: "Edit {{name}}",
      editDescription: "Change their name, role or branch.",
      name: "Full name",
      email: "Email",
      emailLocked: "The email can't be changed.",
      password: "Temporary password",
      passwordHint: "At least 8 characters, with a letter and a number. Share it with them securely.",
      role: "Role",
      rolePlaceholder: "Choose a role",
      branch: "Branch",
      create: "Create account",
      created: "{{name}} was added",
      updated: "{{name}} was updated",
      error: "Couldn't save. Try again.",
    },
  },
};

export default en;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type AdminResources = Widen<typeof en>;
