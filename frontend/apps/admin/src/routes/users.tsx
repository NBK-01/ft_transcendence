import { MoreHorizontal, Pencil, Plus, UserCheck, UserX, Users as UsersIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type FocusEvent } from "react";
import { useTranslation } from "react-i18next";

import type { InternalUser, Organization } from "@trans/api";
import { ConfirmDelete } from "@trans/ui/blocks/confirm-delete";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@trans/ui/components/dropdown-menu";
import { toast } from "@trans/ui/components/toaster";

import { useOrganizations } from "../features/branches/api";
import { useInternalUsers, useRoles, useSetStaffActive } from "../features/users/api";
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

  // mutateAsync is stable, so it can sit in the columns' dependencies.
  const { mutateAsync: setStaffActive } = useSetStaffActive();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<InternalUser | null>(null);
  const askDeactivate = useCallback((user: InternalUser) => {
    setDeactivating(user);
    setDeactivateOpen(true);
  }, []);

  /** Throws when the request fails, so ConfirmDelete keeps the dialog open with its error. */
  const deactivate = async (user: InternalUser) => {
    const { failed } = await setStaffActive({ ids: [user.id], isActive: false });
    if (failed) throw new Error("deactivate failed");
    toast.success(t("app:users.deactivated", { name: user.name }));
  };

  const reactivate = useCallback(
    async (user: InternalUser) => {
      const { failed } = await setStaffActive({ ids: [user.id], isActive: true });
      if (failed) toast.error(t("app:users.statusError"));
      else toast.success(t("app:users.reactivated", { name: user.name }));
    },
    [setStaffActive, t],
  );

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
              <DropdownMenuSeparator />
              {row.original.isActive ? (
                <DropdownMenuItem variant="destructive" onSelect={() => askDeactivate(row.original)}>
                  <UserX aria-hidden="true" />
                  {t("app:users.deactivate")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void reactivate(row.original)}>
                  <UserCheck aria-hidden="true" />
                  {t("app:users.reactivate")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        meta: { align: "end", className: "w-12" },
      }),
    ]);
  }, [t, i18n.language, branchName, roleLabel, openDialog, rememberFocus, askDeactivate, reactivate]);

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
        enableRowSelection
        selectionActions={(selected, clearSelection) => (
          <BulkStatusActions users={selected} onDone={clearSelection} />
        )}
      />
      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editing}
        returnFocusTo={returnFocusRef}
      />
      <ConfirmDelete
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title={t("app:users.deactivateTitle", { name: deactivating?.name ?? "" })}
        description={t("app:users.deactivateBody")}
        actionLabel={t("app:users.deactivate")}
        errorText={t("app:users.statusError")}
        onConfirm={() => (deactivating ? deactivate(deactivating) : undefined)}
        returnFocusTo={returnFocusRef}
      />
    </div>
  );
}

/** Toolbar actions while rows are selected. Each button only counts the rows it would change. */
function BulkStatusActions({ users, onDone }: { users: InternalUser[]; onDone: () => void }) {
  const { t } = useTranslation("app");
  const { mutateAsync: setStaffActive, isPending } = useSetStaffActive();
  const active = users.filter((user) => user.isActive);
  const inactive = users.filter((user) => !user.isActive);

  const run = async (targets: InternalUser[], isActive: boolean) => {
    const { updated, failed } = await setStaffActive({ ids: targets.map((user) => user.id), isActive });
    if (failed) toast.error(t("users.bulkFailed", { count: failed }));
    else toast.success(t("users.bulkUpdated", { count: updated }));
    onDone();
  };

  return (
    <>
      {inactive.length > 0 && (
        <Button
          variant="secondary"
          size="sm"
          prefix={<UserCheck />}
          loading={isPending}
          onClick={() => void run(inactive, true)}
        >
          {t("users.bulkReactivate", { count: inactive.length })}
        </Button>
      )}
      {active.length > 0 && (
        <ConfirmDelete
          trigger={
            <Button variant="error" size="sm" prefix={<UserX />} disabled={isPending}>
              {t("users.bulkDeactivate", { count: active.length })}
            </Button>
          }
          title={t("users.bulkDeactivateTitle")}
          description={t("users.bulkDeactivateBody", { count: active.length })}
          actionLabel={t("users.deactivate")}
          onConfirm={() => run(active, false)}
        />
      )}
    </>
  );
}
