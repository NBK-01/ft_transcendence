import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { InternalUser, Organization } from "@trans/api";
import { Avatar } from "@trans/ui/components/avatar";
import { Badge } from "@trans/ui/components/badge";
import { Button } from "@trans/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@trans/ui/components/dialog";
import { Input } from "@trans/ui/components/input";
import { toast } from "@trans/ui/components/toaster";

import { useInternalUsers } from "../users/api";
import { useAssignStaff, useOrganizations } from "./api";

/**
 * Pick active staff to add to `branch`. Staff already in another branch are
 * moved (the API allows one branch per account), so their current branch is shown.
 * Stays open so several people can be added in a row.
 */
export function AddMemberDialog({
  open,
  onOpenChange,
  branch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Organization;
}) {
  const { t } = useTranslation("app");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("branches.members.addTitle", { name: branch.name })}</DialogTitle>
          <DialogDescription>{t("branches.members.addDescription")}</DialogDescription>
        </DialogHeader>
        {/* Mounted with the content, so the search resets on every open. */}
        <MemberPicker branch={branch} />
      </DialogContent>
    </Dialog>
  );
}

function MemberPicker({ branch }: { branch: Organization }) {
  const { t } = useTranslation(["common", "app"]);
  const staff = useInternalUsers();
  const organizations = useOrganizations();
  const assign = useAssignStaff();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const branchName = useMemo(() => {
    const names = new Map((organizations.data ?? []).map((org) => [org.id, org.name]));
    return (id: string) => names.get(id);
  }, [organizations.data]);

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (staff.data ?? [])
      .filter((user) => user.isActive && user.organizationId !== branch.id)
      .filter((user) => !needle || `${user.name} ${user.email}`.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staff.data, query, branch.id]);

  const add = async (user: InternalUser) => {
    try {
      await assign.mutateAsync({ branchId: branch.id, userId: user.id });
      toast.success(t("app:branches.members.added", { name: user.name, branch: branch.name }));
      // The row (and its button) disappears, so keep focus in the dialog.
      searchRef.current?.focus();
    } catch {
      toast.error(t("app:branches.members.addError", { name: user.name }));
    }
  };

  const pendingId = assign.isPending ? assign.variables.userId : null;

  return (
    <DialogBody className="flex flex-col gap-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-700"
          aria-hidden="true"
        />
        <Input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("app:users.search")}
          aria-label={t("app:users.search")}
          className="ps-8"
          autoFocus
        />
      </div>
      {staff.isPending ? (
        <p className="py-6 text-center text-copy-14 text-gray-900">{t("table.loading")}</p>
      ) : staff.isError ? (
        <p className="py-6 text-center text-copy-14 text-red-900">{t("table.errorTitle")}</p>
      ) : candidates.length === 0 ? (
        <p className="py-6 text-center text-copy-14 text-gray-900">{t("app:branches.members.noCandidates")}</p>
      ) : (
        <ul className="-mx-2 flex max-h-80 flex-col overflow-y-auto" aria-label={t("app:branches.members.candidates")}>
          {candidates.map((user) => {
            const current = user.organizationId ? branchName(user.organizationId) : undefined;
            return (
              <li key={user.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-alpha-100">
                <Avatar name={user.name} size="md" aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-label-14 text-gray-1000">{user.name}</span>
                  <span className="truncate text-copy-13 text-gray-900">
                    {current ? t("app:branches.members.currentBranch", { name: current }) : t("app:users.noBranch")}
                  </span>
                </div>
                {user.roleName && (
                  <Badge variant="outline" size="sm" className="hidden sm:inline-flex">
                    {t(`app:users.roles.${user.roleName}`, { defaultValue: user.roleName })}
                  </Badge>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  loading={pendingId === user.id}
                  disabled={assign.isPending && pendingId !== user.id}
                  aria-label={t("app:branches.members.addOne", { name: user.name })}
                  onClick={() => void add(user)}
                >
                  {current ? t("app:branches.members.move") : t("app:branches.members.addShort")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </DialogBody>
  );
}
