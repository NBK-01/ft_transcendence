import { Search } from "lucide-react";
import { useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import { isApiError, useStaffAccess, useStaffSession, type InternalUser } from "@trans/api";
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
import { FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trans/ui/components/select";
import { toast } from "@trans/ui/components/toaster";
import { focusOnClose } from "@trans/ui/hooks/use-return-focus";

import { useBranchStaff, useOrganizations } from "../branches/api";
import { useBranchFilter } from "../branches/use-branch-filter";
import { useInternalUsers } from "../users/api";
import {
  CONTACT_ALREADY_EXISTS,
  CONTACT_SCOPE_VIOLATION,
  otherParty,
  useContacts,
  useSendContactRequest,
} from "./api";

/**
 * Send contact requests. Admins pick from every staff account; everyone else
 * picks a branch first (the backend only allows your own branch, and the app
 * can't tell which that is: the login response has no branch). Stays open so
 * several people can be added in a row.
 */
export function AddContactDialog({
  open,
  onOpenChange,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation("app");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onCloseAutoFocus={focusOnClose(returnFocusTo)}>
        <DialogHeader>
          <DialogTitle>{t("contacts.addDialog.title")}</DialogTitle>
          <DialogDescription>{t("contacts.addDialog.description")}</DialogDescription>
        </DialogHeader>
        {/* Mounted with the content, so the search and any error reset on every open. */}
        <ContactPicker />
      </DialogContent>
    </Dialog>
  );
}

function ContactPicker() {
  const { t, i18n } = useTranslation(["common", "app"]);
  const { isAdmin } = useStaffAccess();
  const { user: me } = useStaffSession();
  const { branchId: topbarBranch } = useBranchFilter();
  const [branchId, setBranchId] = useState(topbarBranch ?? "");
  const [query, setQuery] = useState("");
  const [scopeError, setScopeError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const organizations = useOrganizations();
  const allStaff = useInternalUsers({ enabled: isAdmin });
  const branchStaff = useBranchStaff(branchId, { enabled: !isAdmin });
  const people = isAdmin ? allStaff : branchStaff;
  const contacts = useContacts();
  const send = useSendContactRequest();

  const candidates = useMemo(() => {
    const myId = me?.id ?? "";
    const taken = new Set((contacts.data ?? []).map((contact) => otherParty(contact, myId).id));
    const needle = query.trim().toLowerCase();
    return (people.data ?? [])
      .filter((user) => user.isActive && user.id !== myId && !taken.has(user.id))
      .filter((user) => !needle || `${user.name} ${user.email}`.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, i18n.language));
  }, [people.data, contacts.data, query, me?.id, i18n.language]);

  const add = async (user: InternalUser) => {
    setScopeError(false);
    try {
      await send.mutateAsync(user.id);
      toast.success(t("app:contacts.requestSent", { name: user.name }));
    } catch (error) {
      const code = isApiError(error) ? error.errorCode : undefined;
      if (code === CONTACT_SCOPE_VIOLATION) setScopeError(true);
      else if (code === CONTACT_ALREADY_EXISTS) toast.error(t("app:contacts.exists", { name: user.name }));
      else toast.error(t("app:contacts.actionError"));
    }
    // The row may be gone (request sent), so keep focus in the dialog.
    searchRef.current?.focus();
  };

  const pendingId = send.isPending ? send.variables : null;
  const waitingForBranch = !isAdmin && !branchId;

  return (
    <DialogBody className="flex flex-col gap-4">
      {!isAdmin && (
        <Select
          value={branchId || undefined}
          onValueChange={(next) => {
            setBranchId(next);
            setScopeError(false);
          }}
        >
          <SelectTrigger aria-label={t("app:contacts.addDialog.branch")}>
            <SelectValue placeholder={t("app:contacts.addDialog.branchPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {(organizations.data ?? [])
              .filter((org) => org.isActive)
              .map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}
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
      {scopeError && <FieldError message="app:contacts.scope" />}
      {waitingForBranch ? (
        <p className="py-6 text-center text-copy-14 text-gray-900">{t("app:contacts.addDialog.chooseBranch")}</p>
      ) : people.isPending || contacts.isPending ? (
        <p className="py-6 text-center text-copy-14 text-gray-900">{t("table.loading")}</p>
      ) : people.isError || contacts.isError ? (
        <p className="py-6 text-center text-copy-14 text-red-900">{t("table.errorTitle")}</p>
      ) : candidates.length === 0 ? (
        <p className="py-6 text-center text-copy-14 text-gray-900">{t("app:contacts.addDialog.noCandidates")}</p>
      ) : (
        <ul className="-mx-2 flex max-h-80 flex-col overflow-y-auto" aria-label={t("app:contacts.addDialog.candidates")}>
          {candidates.map((user) => (
            <li key={user.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-alpha-100">
              <Avatar name={user.name} size="md" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-label-14 text-gray-1000">{user.name}</span>
                <span className="truncate text-copy-13 text-gray-900" dir="ltr">
                  {user.email}
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
                disabled={send.isPending && pendingId !== user.id}
                aria-label={t("app:contacts.addDialog.addOne", { name: user.name })}
                onClick={() => void add(user)}
              >
                {t("app:contacts.addDialog.send")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </DialogBody>
  );
}
