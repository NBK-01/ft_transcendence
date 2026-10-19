import { MoreHorizontal, Pencil, Plus, UserCheck, UserX, Users as UsersIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { InternalUser, Organization } from "@trans/api";
import { ConfirmDelete } from "@trans/ui/blocks/confirm-delete";
import { DataTable } from "@trans/ui/blocks/data-table";
import { DataTableColumnHeader } from "@trans/ui/blocks/data-table-column-header";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Button } from "@trans/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@trans/ui/components/dropdown-menu";
import { toast } from "@trans/ui/components/toaster";
import { useReturnFocus } from "@trans/ui/hooks/use-return-focus";

import { useOrganizations } from "../features/branches/api";
import { useBranchFilter } from "../features/branches/use-branch-filter";
import { useInternalUsers, useRoles, useSetStaffActive } from "../features/users/api";
import { NO_ROLE, staffColumn, staffColumns } from "../features/users/columns";
import { UserFormDialog } from "../features/users/user-form-dialog";

const NO_BRANCH = "";
const column = staffColumn;

/** /users: every staff account, sorted and filtered in the browser (the API returns the full list). */
export function UsersPage() {
  const { t, i18n } = useTranslation(["common", "app"]);
  const users = useInternalUsers();
  const roles = useRoles();
  const organizations = useOrganizations();
  // The topbar branch filter narrows the list before the table's own filters.
  const { branchId } = useBranchFilter();
  const rows = useMemo(
    () => (branchId ? users.data?.filter((user) => user.organizationId === branchId) : users.data),
    [users.data, branchId],
  );

  // `editing` outlives `dialogOpen`, so the dialog keeps its title while it fades out.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InternalUser | null>(null);
  const openDialog = useCallback((user: InternalUser | null) => {
    setEditing(user);
    setDialogOpen(true);
  }, []);
  // The dialogs open from a menu item that's gone by the time they close.
  const { ref: returnFocusRef, remember: rememberFocus } = useReturnFocus();

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
    const staff = staffColumns(t);
    return column.columns([
      staff.person,
      staff.role,
      column.accessor((user) => branchName(user.organizationId), {
        id: "branch",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:users.columns.branch")} />,
        cell: (info) =>
          info.getValue() || <span className="text-gray-900">{t("app:users.noBranch")}</span>,
      }),
      staff.status,
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
  }, [t, i18n.language, branchName, openDialog, rememberFocus, askDeactivate, reactivate]);

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
      // Not needed while the topbar already picks one branch.
      ...(branchId
        ? []
        : [
            {
              column: "branch",
              title: t("app:users.columns.branch"),
              options: [
                ...(organizations.data ?? []).map((org) => ({ value: org.name, label: org.name })),
                { value: NO_BRANCH, label: t("app:users.noBranch") },
              ],
            },
          ]),
      {
        column: "status",
        title: t("app:users.columns.status"),
        options: (["active", "deactivated"] as const).map((status) => ({
          value: status,
          label: t(`app:users.status.${status}`),
        })),
      },
    ],
    [t, roleLabel, roles.data, organizations.data, branchId],
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
        // A new topbar branch starts the table fresh, so a hidden branch filter can't linger.
        key={branchId ?? "all"}
        columns={columns}
        data={rows}
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
