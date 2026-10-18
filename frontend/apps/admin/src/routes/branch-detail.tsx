import { ArrowLeft, Building2, Mail, Pencil, UserMinus, UserPlus, Users as UsersIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type FocusEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { isApiError, type InternalUser, type Organization } from "@trans/api";
import { ConfirmDelete } from "@trans/ui/blocks/confirm-delete";
import { createDataTableColumnHelper, DataTable } from "@trans/ui/blocks/data-table";
import { DataTableColumnHeader } from "@trans/ui/blocks/data-table-column-header";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Avatar } from "@trans/ui/components/avatar";
import { Badge } from "@trans/ui/components/badge";
import { Button } from "@trans/ui/components/button";
import { Skeleton } from "@trans/ui/components/skeleton";
import { toast } from "@trans/ui/components/toaster";

import { AddMemberDialog } from "../features/branches/add-member-dialog";
import { useBranchStaff, useOrganization, useRemoveStaff } from "../features/branches/api";
import { BranchFormDialog } from "../features/branches/branch-form-dialog";

const column = createDataTableColumnHelper<InternalUser>();

/** /branches/:id: one branch, its details and its members. */
export function BranchDetailPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation(["common", "app"]);
  const branch = useOrganization(id);

  if (branch.isPending) return <DetailSkeleton />;
  if (branch.isError) {
    const notFound = isApiError(branch.error) && branch.error.status === 404;
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <EmptyState
          icon={Building2}
          title={notFound ? t("app:branches.detail.notFoundTitle") : t("table.errorTitle")}
          description={notFound ? t("app:branches.detail.notFoundBody") : t("table.errorBody")}
          action={
            notFound ? undefined : (
              <Button variant="secondary" onClick={() => void branch.refetch()}>
                {t("table.retry")}
              </Button>
            )
          }
        />
      </div>
    );
  }
  return <BranchDetail branch={branch.data} />;
}

function BranchDetail({ branch }: { branch: Organization }) {
  const { t } = useTranslation(["common", "app"]);
  const members = useBranchStaff(branch.id);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // The remove dialog opens from a row button, so focus goes back there; after a
  // removal that row is gone, so it goes to "Add member" instead.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const rememberFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    returnFocusRef.current = event.currentTarget;
  }, []);
  const { mutateAsync: removeStaff } = useRemoveStaff();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState<InternalUser | null>(null);
  const askRemove = useCallback((user: InternalUser) => {
    setRemoving(user);
    setRemoveOpen(true);
  }, []);

  /** Throws when the request fails, so ConfirmDelete keeps the dialog open with its error. */
  const remove = async (user: InternalUser) => {
    await removeStaff({ branchId: branch.id, userId: user.id });
    returnFocusRef.current = addButtonRef.current;
    toast.success(t("app:branches.members.removed", { name: user.name, branch: branch.name }));
  };

  const columns = useMemo(
    () =>
      column.columns([
        // Name and email in one value, so the search box matches either.
        column.accessor((user) => `${user.name} ${user.email}`, {
          id: "person",
          header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:users.columns.name")} />,
          cell: ({ row }) => (
            <div className="flex items-center gap-3">
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
        column.accessor((user) => user.roleName ?? "none", {
          id: "role",
          header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:users.columns.role")} />,
          cell: (info) => (
            <Badge variant="outline" size="sm">
              {t(`app:users.roles.${info.getValue()}`, { defaultValue: info.getValue() })}
            </Badge>
          ),
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
        column.display({
          id: "actions",
          cell: ({ row }) => (
            <Button
              variant="tertiary"
              size="sm"
              shape="square"
              aria-label={t("app:branches.members.removeOne", { name: row.original.name })}
              onFocus={rememberFocus}
              onClick={() => askRemove(row.original)}
            >
              <UserMinus />
            </Button>
          ),
          enableSorting: false,
          meta: { align: "end", className: "w-12" },
        }),
      ]),
    [t, rememberFocus, askRemove],
  );

  return (
    <div className="flex flex-col gap-8">
      <title>{`${branch.name} · ${t("brand.name")}`}</title>
      <div className="flex flex-col gap-4">
        <BackLink />
        <PageHeader
          title={branch.name}
          description={branch.description ?? undefined}
          actions={
            <>
              <Button variant="secondary" prefix={<Pencil />} onClick={() => setEditOpen(true)}>
                {t("app:branches.edit")}
              </Button>
              <Button ref={addButtonRef} prefix={<UserPlus />} onClick={() => setAddOpen(true)}>
                {t("app:branches.members.add")}
              </Button>
            </>
          }
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-copy-14 text-gray-900">
          <Badge variant={branch.isActive ? "green" : "gray"} size="sm">
            {t(`app:branches.status.${branch.isActive ? "active" : "deactivated"}`)}
          </Badge>
          <span className="flex items-center gap-2">
            <Mail className="size-4" aria-hidden="true" />
            {branch.contactEmail ? (
              <a href={`mailto:${branch.contactEmail}`} dir="ltr" className="focus-ring rounded-sm text-gray-1000 hover:underline">
                {branch.contactEmail}
              </a>
            ) : (
              t("app:branches.noContact")
            )}
          </span>
        </div>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-heading-20">
          {t("app:branches.members.title")}
        </h2>
        <DataTable
          columns={columns}
          data={members.data}
          getRowId={(user) => user.id}
          isLoading={members.isPending}
          error={members.error}
          onRetry={() => void members.refetch()}
          search={{ column: "person", placeholder: t("app:users.search") }}
          emptyState={
            <EmptyState
              icon={UsersIcon}
              title={t("app:branches.members.emptyTitle")}
              description={t("app:branches.members.emptyBody")}
              action={
                <Button variant="secondary" prefix={<UserPlus />} onClick={() => setAddOpen(true)}>
                  {t("app:branches.members.add")}
                </Button>
              }
            />
          }
          pageSizeOptions={[20, 50, 100]}
        />
      </section>

      <BranchFormDialog open={editOpen} onOpenChange={setEditOpen} branch={branch} />
      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} branch={branch} />
      <ConfirmDelete
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={t("app:branches.members.removeTitle", { name: removing?.name ?? "", branch: branch.name })}
        description={t("app:branches.members.removeBody")}
        actionLabel={t("app:branches.members.remove")}
        errorText={t("app:branches.members.removeError")}
        onConfirm={() => (removing ? remove(removing) : undefined)}
        returnFocusTo={returnFocusRef}
      />
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation("common");
  return (
    <Link
      to="/branches"
      className="focus-ring flex w-fit items-center gap-1.5 rounded-md text-label-14 text-gray-900 hover:text-gray-1000"
    >
      <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
      {t("nav.branches")}
    </Link>
  );
}

function DetailSkeleton() {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <span className="sr-only">{t("table.loading")}</span>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
