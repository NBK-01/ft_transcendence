import { Ban, ExternalLink, KeyRound, MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useApiKeys, useRevokeApiKey, type ApiKey } from "@trans/api";
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
  DropdownMenuTrigger,
} from "@trans/ui/components/dropdown-menu";
import { toast } from "@trans/ui/components/toaster";
import { useReturnFocus } from "@trans/ui/hooks/use-return-focus";

import { CreateApiKeyDialog } from "../features/api-keys/create-api-key-dialog";
import { useBranchFilter } from "../features/branches/use-branch-filter";
import { useActivityTime } from "../features/messages/use-activity-time";

const column = createDataTableColumnHelper<ApiKey>();

// Public, unauthenticated — the partner-facing subset of the backend's Swagger UI, safe
// to share with partner developers. An absolute URL since admin is its own Railway
// deployment now, not behind the same origin as the backend (relative /api/... 404s).
const API_DOCS_URL = `${import.meta.env.VITE_API_URL || "/api"}/public-docs`;

/**
 * /api-keys (admins only): the keys partner systems use to call the public
 * API, one branch each. Follows the topbar's branch filter. The full key is
 * shown once, when it's created (CreateApiKeyDialog); here it's masked.
 */
export function ApiKeysPage() {
  const { t, i18n } = useTranslation(["common", "app"]);
  const { branchId } = useBranchFilter();
  const apiKeys = useApiKeys({ organizationId: branchId ?? undefined });

  const [createOpen, setCreateOpen] = useState(false);
  // The dialogs open from a button or a menu item that may be gone by the time they close.
  const { ref: returnFocusRef, remember: rememberFocus } = useReturnFocus();
  const createButtonRef = useRef<HTMLButtonElement>(null);

  // mutateAsync is stable, so it can sit in the columns' dependencies.
  const { mutateAsync: revoke } = useRevokeApiKey();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const askRevoke = useCallback((apiKey: ApiKey) => {
    setRevoking(apiKey);
    setRevokeOpen(true);
  }, []);

  /** Throws when the request fails, so ConfirmDelete keeps the dialog open with its error. */
  const confirmRevoke = async (apiKey: ApiKey) => {
    await revoke(apiKey.id);
    // A revoked row has no menu left to return to.
    returnFocusRef.current = createButtonRef.current;
    toast.success(t("app:apiKeys.revoked", { name: apiKey.name }));
  };

  // Rebuilt when the language changes, so labels and dates follow.
  const columns = useMemo(() => {
    const dateFormat = new Intl.DateTimeFormat(`${i18n.language}-u-nu-latn`, { dateStyle: "medium" });
    return column.columns([
      column.accessor("name", {
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:apiKeys.columns.name")} />,
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="max-w-xs truncate text-label-14 text-gray-1000">{row.original.name}</span>
            {row.original.createdBy && (
              <span className="text-copy-13 text-gray-900">
                {t("app:apiKeys.createdBy", { name: row.original.createdBy.name })}
              </span>
            )}
          </div>
        ),
      }),
      column.accessor((apiKey) => apiKey.organization.name, {
        id: "branch",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:apiKeys.columns.branch")} />,
      }),
      column.accessor("maskedKey", {
        header: t("app:apiKeys.columns.key"),
        cell: (info) => (
          <code dir="ltr" className="font-mono text-copy-13 text-gray-1000">
            {info.getValue()}
          </code>
        ),
        enableSorting: false,
      }),
      column.accessor((apiKey) => (apiKey.revokedAt ? "revoked" : "active"), {
        id: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:apiKeys.columns.status")} />,
        cell: (info) => (
          <Badge variant={info.getValue() === "active" ? "green" : "gray"} size="sm">
            {t(`app:apiKeys.status.${info.getValue()}`)}
          </Badge>
        ),
      }),
      column.accessor((apiKey) => apiKey.lastUsedAt ?? "", {
        id: "lastUsed",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:apiKeys.columns.lastUsed")} />,
        cell: (info) =>
          info.getValue() ? (
            <LastUsed iso={info.getValue()} />
          ) : (
            <span className="text-gray-900">{t("app:apiKeys.never")}</span>
          ),
        sortDescFirst: true,
        meta: { align: "end" },
      }),
      column.accessor("createdAt", {
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:apiKeys.columns.created")} />,
        cell: (info) => dateFormat.format(new Date(info.getValue())),
        sortFn: "datetime",
        sortDescFirst: true,
        meta: { align: "end" },
      }),
      column.display({
        id: "actions",
        // A revoked key has nothing left to do: it stays listed for the record.
        cell: ({ row }) =>
          !row.original.revokedAt && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="tertiary"
                  size="sm"
                  shape="square"
                  aria-label={t("app:apiKeys.rowActions", { name: row.original.name })}
                  onFocus={rememberFocus}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => askRevoke(row.original)}>
                  <Ban aria-hidden="true" />
                  {t("app:apiKeys.revoke")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        enableSorting: false,
        meta: { align: "end", className: "w-12" },
      }),
    ]);
  }, [t, i18n.language, rememberFocus, askRevoke]);

  const filters = useMemo(
    () => [
      {
        column: "status",
        title: t("app:apiKeys.columns.status"),
        options: (["active", "revoked"] as const).map((status) => ({
          value: status,
          label: t(`app:apiKeys.status.${status}`),
        })),
      },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("nav.apiKeys")} · ${t("brand.name")}`}</title>
      <PageHeader
        title={t("nav.apiKeys")}
        description={t("app:pages.apiKeys")}
        actions={
          <>
            {/* asChild renders only the link, so the icon goes inside it. */}
            <Button variant="secondary" asChild>
              <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer">
                {t("app:apiKeys.docs")}
                <ExternalLink aria-hidden="true" />
                <span className="sr-only">{t("app:shipment.newTab")}</span>
              </a>
            </Button>
            <Button ref={createButtonRef} prefix={<Plus />} onFocus={rememberFocus} onClick={() => setCreateOpen(true)}>
              {t("app:apiKeys.create")}
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        data={apiKeys.data}
        getRowId={(apiKey) => apiKey.id}
        isLoading={apiKeys.isPending}
        error={apiKeys.error}
        onRetry={() => void apiKeys.refetch()}
        search={{ column: "name", placeholder: t("app:apiKeys.search") }}
        filters={filters}
        emptyState={
          <EmptyState icon={KeyRound} title={t("app:apiKeys.emptyTitle")} description={t("app:apiKeys.emptyBody")} />
        }
        pageSizeOptions={[20, 50, 100]}
      />
      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultBranchId={branchId}
        returnFocusTo={returnFocusRef}
      />
      <ConfirmDelete
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title={t("app:apiKeys.revokeTitle", { name: revoking?.name ?? "" })}
        description={t("app:apiKeys.revokeBody")}
        confirmText={revoking?.name}
        actionLabel={t("app:apiKeys.revoke")}
        errorText={t("app:apiKeys.revokeError")}
        onConfirm={() => (revoking ? confirmRevoke(revoking) : undefined)}
        returnFocusTo={returnFocusRef}
      />
    </div>
  );
}

/**
 * "14:05", "Yesterday" or "12 Oct", with the full date on hover. Its own
 * component: useActivityTime gives a new function each render, which would
 * rebuild (and reset) the table's columns if they depended on it.
 */
function LastUsed({ iso }: { iso: string }) {
  const { i18n } = useTranslation();
  const activityTime = useActivityTime();
  const full = new Intl.DateTimeFormat(`${i18n.language}-u-nu-latn`, { dateStyle: "medium", timeStyle: "short" });
  return (
    <time dateTime={iso} title={full.format(new Date(iso))}>
      {activityTime(iso)}
    </time>
  );
}
