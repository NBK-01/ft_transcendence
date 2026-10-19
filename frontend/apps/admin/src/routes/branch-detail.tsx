import { ArrowLeft, Building2, Mail, Pencil, UserMinus, UserPlus, Users as UsersIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { isApiError, type InternalUser, type Organization } from "@trans/api";
import { ConfirmDelete } from "@trans/ui/blocks/confirm-delete";
import { DataTable } from "@trans/ui/blocks/data-table";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Badge } from "@trans/ui/components/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@trans/ui/components/breadcrumb";
import { Button } from "@trans/ui/components/button";
import { Skeleton } from "@trans/ui/components/skeleton";
import { toast } from "@trans/ui/components/toaster";
import { useReturnFocus } from "@trans/ui/hooks/use-return-focus";

import { AddMemberDialog } from "../features/branches/add-member-dialog";
import { useBranchStaff, useOrganization, useRemoveStaff } from "../features/branches/api";
import { BranchFormDialog } from "../features/branches/branch-form-dialog";
import { useBranchFilter } from "../features/branches/use-branch-filter";
import { staffColumn, staffColumns } from "../features/users/columns";

const column = staffColumn;

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
  const { ref: returnFocusRef, remember: rememberFocus } = useReturnFocus();
  const addButtonRef = useRef<HTMLButtonElement>(null);
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

  const columns = useMemo(() => {
    const staff = staffColumns(t);
    return column.columns([
        staff.person,
        staff.role,
        staff.status,
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
    ]);
  }, [t, rememberFocus, askRemove]);

  return (
    <div className="flex flex-col gap-8">
      <title>{`${branch.name} · ${t("brand.name")}`}</title>
      <div className="flex flex-col gap-4">
        <BranchBreadcrumb name={branch.name} />
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
      {/* From the empty state, that button is gone once someone's added; the header's stays. */}
      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} branch={branch} returnFocusTo={addButtonRef} />
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

function BranchBreadcrumb({ name }: { name: string }) {
  const { t } = useTranslation("common");
  const { withBranch } = useBranchFilter();
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to={withBranch("/branches")}>{t("nav.branches")}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{name}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Not-found and error states: no branch name for a breadcrumb, just the way back. */
function BackLink() {
  const { t } = useTranslation("common");
  const { withBranch } = useBranchFilter();
  return (
    <Link
      to={withBranch("/branches")}
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
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
