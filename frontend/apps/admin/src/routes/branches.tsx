import { Ban, Building2, MoreHorizontal, Pencil, Plus, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type FocusEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { Organization } from "@trans/api";
import { ConfirmDelete } from "@trans/ui/blocks/confirm-delete";
import { createDataTableColumnHelper, DataTable } from "@trans/ui/blocks/data-table";
import { DataTableColumnHeader } from "@trans/ui/blocks/data-table-column-header";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
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

import { useOrganizations, useSetOrganizationActive } from "../features/branches/api";
import { BranchFormDialog } from "../features/branches/branch-form-dialog";
import { useInternalUsers } from "../features/users/api";

const column = createDataTableColumnHelper<Organization>();

/** /branches: every branch (organization), sorted and filtered in the browser (the API returns the full list). */
export function BranchesPage() {
  const { t, i18n } = useTranslation(["common", "app"]);
  const organizations = useOrganizations();
  // The API has no member count, so it's counted from the staff list.
  const staff = useInternalUsers();

  // `branch` outlives `open`, so the dialog keeps its title while it fades out.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const openDialog = useCallback((branch: Organization | null) => {
    setEditing(branch);
    setDialogOpen(true);
  }, []);
  // The dialog opens from a menu item that's gone by the time it closes, so
  // remember the button that started it and send focus back there.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const rememberFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    returnFocusRef.current = event.currentTarget;
  }, []);

  // mutateAsync is stable, so it can sit in the columns' dependencies.
  const { mutateAsync: setActive } = useSetOrganizationActive();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<Organization | null>(null);
  const askDeactivate = useCallback((branch: Organization) => {
    setDeactivating(branch);
    setDeactivateOpen(true);
  }, []);

  /** Throws when the request fails, so ConfirmDelete keeps the dialog open with its error. */
  const deactivate = async (branch: Organization) => {
    await setActive({ id: branch.id, isActive: false });
    toast.success(t("app:branches.deactivated", { name: branch.name }));
  };

  const reactivate = useCallback(
    async (branch: Organization) => {
      try {
        await setActive({ id: branch.id, isActive: true });
        toast.success(t("app:branches.reactivated", { name: branch.name }));
      } catch {
        toast.error(t("app:branches.statusError"));
      }
    },
    [setActive, t],
  );

  const memberCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of staff.data ?? []) {
      if (user.organizationId) counts.set(user.organizationId, (counts.get(user.organizationId) ?? 0) + 1);
    }
    return (id: string) => counts.get(id) ?? 0;
  }, [staff.data]);

  // Rebuilt when the language or member counts change, so labels, numbers and dates follow.
  const columns = useMemo(() => {
    const locale = `${i18n.language}-u-nu-latn`;
    const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
    const numberFormat = new Intl.NumberFormat(locale);
    return column.columns([
      column.accessor("name", {
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:branches.columns.name")} />,
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <Link
              to={`/branches/${row.original.id}`}
              className="focus-ring w-fit max-w-full truncate rounded-sm text-label-14 text-gray-1000 hover:underline"
            >
              {row.original.name}
            </Link>
            {row.original.description && (
              <span className="max-w-md truncate text-copy-13 text-gray-900">{row.original.description}</span>
            )}
          </div>
        ),
      }),
      column.accessor((branch) => branch.contactEmail ?? "", {
        id: "contactEmail",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("app:branches.columns.contactEmail")} />
        ),
        cell: (info) =>
          info.getValue() ? (
            <span dir="ltr">{info.getValue()}</span>
          ) : (
            <span className="text-gray-900">{t("app:branches.noContact")}</span>
          ),
      }),
      column.accessor((branch) => memberCount(branch.id), {
        id: "members",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:branches.columns.members")} />,
        cell: (info) => <span className="tabular-nums">{numberFormat.format(info.getValue())}</span>,
        sortDescFirst: true,
        meta: { align: "end" },
      }),
      column.accessor((branch) => (branch.isActive ? "active" : "deactivated"), {
        id: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:branches.columns.status")} />,
        cell: (info) => (
          <Badge variant={info.getValue() === "active" ? "green" : "gray"} size="sm">
            {t(`app:branches.status.${info.getValue()}`)}
          </Badge>
        ),
      }),
      column.accessor("createdAt", {
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:branches.columns.created")} />,
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
                aria-label={t("app:branches.rowActions", { name: row.original.name })}
                onFocus={rememberFocus}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openDialog(row.original)}>
                <Pencil aria-hidden="true" />
                {t("app:branches.edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {row.original.isActive ? (
                <DropdownMenuItem variant="destructive" onSelect={() => askDeactivate(row.original)}>
                  <Ban aria-hidden="true" />
                  {t("app:branches.deactivate")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void reactivate(row.original)}>
                  <RotateCcw aria-hidden="true" />
                  {t("app:branches.reactivate")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        meta: { align: "end", className: "w-12" },
      }),
    ]);
  }, [t, i18n.language, memberCount, openDialog, rememberFocus, askDeactivate, reactivate]);

  const filters = useMemo(
    () => [
      {
        column: "status",
        title: t("app:branches.columns.status"),
        options: (["active", "deactivated"] as const).map((status) => ({
          value: status,
          label: t(`app:branches.status.${status}`),
        })),
      },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("nav.branches")} · ${t("brand.name")}`}</title>
      <PageHeader
        title={t("nav.branches")}
        description={t("app:pages.branches")}
        actions={
          <Button prefix={<Plus />} onFocus={rememberFocus} onClick={() => openDialog(null)}>
            {t("app:branches.newBranch")}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={organizations.data}
        getRowId={(branch) => branch.id}
        isLoading={organizations.isPending || staff.isPending}
        error={organizations.error ?? staff.error}
        onRetry={() => {
          void organizations.refetch();
          void staff.refetch();
        }}
        search={{ column: "name", placeholder: t("app:branches.search") }}
        filters={filters}
        emptyState={
          <EmptyState
            icon={Building2}
            title={t("app:branches.emptyTitle")}
            description={t("app:branches.emptyBody")}
          />
        }
        pageSizeOptions={[20, 50, 100]}
      />
      <BranchFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        branch={editing}
        returnFocusTo={returnFocusRef}
      />
      <ConfirmDelete
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title={t("app:branches.deactivateTitle", { name: deactivating?.name ?? "" })}
        description={t("app:branches.deactivateBody")}
        confirmText={deactivating?.name}
        actionLabel={t("app:branches.deactivate")}
        errorText={t("app:branches.statusError")}
        onConfirm={() => (deactivating ? deactivate(deactivating) : undefined)}
        returnFocusTo={returnFocusRef}
      />
    </div>
  );
}
