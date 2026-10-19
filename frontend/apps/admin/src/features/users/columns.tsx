import type { useTranslation } from "react-i18next";

import type { InternalUser } from "@trans/api";
import { createDataTableColumnHelper } from "@trans/ui/blocks/data-table";
import { DataTableColumnHeader } from "@trans/ui/blocks/data-table-column-header";
import { Avatar } from "@trans/ui/components/avatar";
import { Badge } from "@trans/ui/components/badge";

type AppT = ReturnType<typeof useTranslation<["common", "app"]>>["t"];

export const staffColumn = createDataTableColumnHelper<InternalUser>();

/** The role filter's value for staff without a role. */
export const NO_ROLE = "none";

/** Person, role and status: the columns the Users table and a branch's members share. */
export function staffColumns(t: AppT) {
  return {
    // Name and email in one value, so the search box matches either.
    person: staffColumn.accessor((user) => `${user.name} ${user.email}`, {
      id: "person",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:users.columns.name")} />,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {/* The name is right next to it, so the avatar stays silent for screen readers. */}
          <Avatar name={row.original.name} size="md" aria-hidden="true" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-label-14 text-gray-1000">{row.original.name}</span>
            <span className="truncate text-copy-13 text-gray-900" dir="ltr">
              {row.original.email}
            </span>
          </div>
        </div>
      ),
    }),
    role: staffColumn.accessor((user) => user.roleName ?? NO_ROLE, {
      id: "role",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:users.columns.role")} />,
      cell: (info) => (
        <Badge variant="outline" size="sm">
          {t(`app:users.roles.${info.getValue()}`, { defaultValue: info.getValue() })}
        </Badge>
      ),
    }),
    status: staffColumn.accessor((user) => (user.isActive ? "active" : "deactivated"), {
      id: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:users.columns.status")} />,
      cell: (info) => (
        <Badge variant={info.getValue() === "active" ? "green" : "gray"} size="sm">
          {t(`app:users.status.${info.getValue()}`)}
        </Badge>
      ),
    }),
  };
}
