import { MoreHorizontal, Pencil, Plus, Users as UsersIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type FocusEvent } from "react";
import { useTranslation } from "react-i18next";

import type { InternalUser, Organization } from "@trans/api";
import { createDataTableColumnHelper, DataTable } from "@trans/ui/blocks/data-table";
import { DataTableColumnHeader } from "@trans/ui/blocks/data-table-column-header";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Avatar } from "@trans/ui/components/avatar";
import { Badge } from "@trans/ui/components/badge";
import { Button } from "@trans/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@trans/ui/components/dropdown-menu";

import { useInternalUsers, useOrganizations, useRoles } from "../features/users/api";
import { UserFormDialog } from "../features/users/user-form-dialog";

const NO_ROLE = "none";
const NO_BRANCH = "";

const column = createDataTableColumnHelper<InternalUser>();

/** /users: every staff account, sorted and filtered in the browser (the API returns the full list). */
export function UsersPage() {
  const { t, i18n } = useTranslation(["common", "app"]);
  const users = useInternalUsers();
  const roles = useRoles();
  const organizations = useOrganizations();

  // `user` outlives `open`, so the dialog keeps its title while it fades out.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InternalUser | null>(null);
  const openDialog = useCallback((user: InternalUser | null) => {
    setEditing(user);
    setDialogOpen(true);
  }, []);
  // The dialog opens from a menu item that's gone by the time it closes, so
  // remember the button that started it and send focus back there.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const rememberFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    returnFocusRef.current = event.currentTarget;
  }, []);

  const branchName = useMemo(() => {
    const names = new Map((organizations.data ?? []).map((org: Organization) => [org.id, org.name]));
    return (id: string | null) => (id ? (names.get(id) ?? NO_BRANCH) : NO_BRANCH);
  }, [organizations.data]);

  const roleLabel = useCallback((name: string) => t(`app:users.roles.${name}`, { defaultValue: name }), [t]);

  // Rebuilt when the language or branch names change, so labels and the dates follow.
  const columns = useMemo(() => {
    const dateFormat = new Intl.DateTimeFormat(`${i18n.language}-u-nu-latn`, { dateStyle: "medium" });
    return column.columns([
      // Name and email in one value, so the search box matches either.
      column.accessor((user) => `${user.name} ${user.email}`, {
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
      column.accessor((user) => user.roleName ?? NO_ROLE, {
        id: "role",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:users.columns.role")} />,
        cell: (info) => (
          <Badge variant="outline" size="sm">
            {roleLabel(info.getValue())}
          </Badge>
        ),
      }),
      column.accessor((user) => branchName(user.organizationId), {
        id: "branch",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:users.columns.branch")} />,
        cell: (info) =>
          info.getValue() || <span className="text-gray-900">{t("app:users.noBranch")}</span>,
      }),
      column.accessor((user) => (user.isActive ? "active" : "deactivated"), {
        id: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:users.columns.status")} />,
        cell: (info) => (
          <Badge variant={info.getValue() === "active" ? "green" : "gray"} size="sm">
            {t(`app:users.status.${info.getValue()}`)}
          </Badge>
        ),
      }),
      column.accessor("createdAt", {
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:users.columns.created")} />,
        cell: (info) => dateFormat.format(new Date(info.getValue())),
        sortFn: "datetime",
        sortDescFirst: true,
        meta: { align: "end" },
      }),
      column.display({
        id: "actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="tertiary"
                size="sm"
                shape="square"
                aria-label={t("app:users.rowActions", { name: row.original.name })}
                onFocus={rememberFocus}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openDialog(row.original)}>
                <Pencil aria-hidden="true" />
                {t("app:users.edit")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        meta: { align: "end", className: "w-12" },
      }),
    ]);
  }, [t, i18n.language, branchName, roleLabel, openDialog, rememberFocus]);

  const filters = useMemo(
    () => [
      {
        column: "role",
        title: t("app:users.columns.role"),
        options: [...(roles.data ?? []).map((role) => role.name), NO_ROLE].map((name) => ({
          value: name,
          label: roleLabel(name),
        })),
      },
      {
        column: "branch",
        title: t("app:users.columns.branch"),
        options: [
          ...(organizations.data ?? []).map((org) => ({ value: org.name, label: org.name })),
          { value: NO_BRANCH, label: t("app:users.noBranch") },
        ],
      },
      {
        column: "status",
        title: t("app:users.columns.status"),
        options: (["active", "deactivated"] as const).map((status) => ({
          value: status,
          label: t(`app:users.status.${status}`),
        })),
      },
    ],
    [t, roleLabel, roles.data, organizations.data],
  );

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("nav.users")} · ${t("brand.name")}`}</title>
      <PageHeader
        title={t("nav.users")}
        description={t("app:pages.users")}
        actions={
          <Button prefix={<Plus />} onFocus={rememberFocus} onClick={() => openDialog(null)}>
            {t("app:users.newAccount")}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={users.data}
        getRowId={(user) => user.id}
        isLoading={users.isPending || organizations.isPending}
        error={users.error ?? organizations.error}
        onRetry={() => {
          void users.refetch();
          void organizations.refetch();
        }}
        search={{ column: "person", placeholder: t("app:users.search") }}
        filters={filters}
        emptyState={
          <EmptyState icon={UsersIcon} title={t("app:users.emptyTitle")} description={t("app:users.emptyBody")} />
        }
        pageSizeOptions={[20, 50, 100]}
      />
      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editing}
        returnFocusTo={returnFocusRef}
      />
    </div>
  );
}
