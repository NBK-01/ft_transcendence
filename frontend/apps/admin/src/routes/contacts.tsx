import { Ban, Check, Contact as ContactIcon, MoreHorizontal, UserMinus, UserPlus, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { isApiError, useStaffSession, type Contact } from "@trans/api";
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
  DropdownMenuTrigger,
} from "@trans/ui/components/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@trans/ui/components/tabs";
import { toast } from "@trans/ui/components/toaster";
import { useReturnFocus } from "@trans/ui/hooks/use-return-focus";

import { AddContactDialog } from "../features/contacts/add-contact-dialog";
import {
  CONTACT_NOT_PENDING,
  otherParty,
  tabOf,
  useAcceptContact,
  useBlockContact,
  useContacts,
  useRejectContact,
  useRemoveContact,
  type ContactTab,
} from "../features/contacts/api";

const TABS: ContactTab[] = ["accepted", "received", "sent", "blocked"];
const column = createDataTableColumnHelper<Contact>();

/** What the confirmation dialog is about to do. */
type Confirming = { kind: "remove" | "block" | "unblock"; contact: Contact };

/**
 * /contacts: the signed-in staff member's contacts, split by state. Staff can
 * only message their accepted contacts. Every role has this page.
 */
export function ContactsPage() {
  const { t, i18n } = useTranslation(["common", "app"]);
  const { user } = useStaffSession();
  const myId = user?.id ?? "";
  const contacts = useContacts();
  const [tab, setTab] = useState<ContactTab>("accepted");
  const [addOpen, setAddOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const tabsListRef = useRef<HTMLDivElement>(null);
  // The confirm dialogs open from a menu item or a row button; see `afterRowGone`.
  const { ref: returnFocusRef, remember: rememberFocus } = useReturnFocus();

  const byTab = useMemo(() => {
    const groups: Record<ContactTab, Contact[]> = { accepted: [], received: [], sent: [], blocked: [] };
    for (const contact of contacts.data ?? []) groups[tabOf(contact, myId)].push(contact);
    return groups;
  }, [contacts.data, myId]);

  // mutateAsync is stable, so it can sit in the columns' dependencies.
  const { mutateAsync: acceptContact, isPending: accepting, variables: acceptingId } = useAcceptContact();
  const { mutateAsync: rejectContact, isPending: rejecting, variables: rejectingId } = useRejectContact();
  const { mutateAsync: removeContact, isPending: removing, variables: removingId } = useRemoveContact();
  const { mutateAsync: blockContact } = useBlockContact();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState<Confirming | null>(null);

  /** A row that's gone (moved tab, or deleted) takes its buttons with it: focus the current tab instead. */
  const activeTab = useCallback(
    () => tabsListRef.current?.querySelector<HTMLElement>("[role=tab][data-state=active]") ?? null,
    [],
  );

  /** Accept, reject and cancel: one click, no confirmation, the row leaves this tab. */
  const quick = useCallback(
    async (run: (id: string) => Promise<unknown>, contact: Contact, done: string) => {
      try {
        await run(contact.id);
        toast.success(t(done, { name: otherParty(contact, myId).name }));
        activeTab()?.focus();
      } catch (error) {
        const notPending = isApiError(error) && error.errorCode === CONTACT_NOT_PENDING;
        toast.error(t(notPending ? "app:contacts.notPending" : "app:contacts.actionError"));
      }
    },
    [t, myId, activeTab],
  );

  const askConfirm = useCallback((kind: Confirming["kind"], contact: Contact) => {
    setConfirming({ kind, contact });
    setConfirmOpen(true);
  }, []);

  /** Throws when the request fails, so ConfirmDelete keeps the dialog open with its error. */
  const confirm = async ({ kind, contact }: Confirming) => {
    await (kind === "block" ? blockContact : removeContact)(contact.id);
    returnFocusRef.current = activeTab();
    const done = { remove: "removed", block: "blocked", unblock: "unblocked" }[kind];
    toast.success(t(`app:contacts.${done}`, { name: otherParty(contact, myId).name }));
  };

  // Rebuilt per tab: the date column and the actions differ.
  const columns = useMemo(() => {
    const dateFormat = new Intl.DateTimeFormat(`${i18n.language}-u-nu-latn`, { dateStyle: "medium" });
    return column.columns([
      // Name and email in one value, so the search box matches either.
      column.accessor(
        (contact) => {
          const person = otherParty(contact, myId);
          return `${person.name} ${person.email}`;
        },
        {
          id: "person",
          header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:contacts.columns.person")} />,
          cell: ({ row }) => {
            const person = otherParty(row.original, myId);
            return (
              <div className="flex items-center gap-3">
                <Avatar name={person.name} size="md" aria-hidden="true" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-label-14 text-gray-1000">{person.name}</span>
                  <span className="truncate text-copy-13 text-gray-900" dir="ltr">
                    {person.email}
                  </span>
                </div>
              </div>
            );
          },
        },
      ),
      // Sent and received requests date from when they were sent; the others from when they last changed.
      column.accessor((contact) => (tab === "received" || tab === "sent" ? contact.createdAt : contact.updatedAt), {
        id: "date",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t(`app:contacts.columns.${tab}`)} />,
        cell: (info) => dateFormat.format(new Date(info.getValue())),
        sortFn: "datetime",
        sortDescFirst: true,
        meta: { align: "end" },
      }),
      column.display({
        id: "actions",
        cell: ({ row }) => {
          const contact = row.original;
          const who = otherParty(contact, myId).name;
          if (tab === "received") {
            return (
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  prefix={<Check />}
                  aria-label={t("app:contacts.acceptOne", { name: who })}
                  loading={accepting && acceptingId === contact.id}
                  onClick={() => void quick(acceptContact, contact, "app:contacts.accepted")}
                >
                  {t("app:contacts.accept")}
                </Button>
                <Button
                  variant="tertiary"
                  size="sm"
                  prefix={<X />}
                  aria-label={t("app:contacts.rejectOne", { name: who })}
                  loading={rejecting && rejectingId === contact.id}
                  onClick={() => void quick(rejectContact, contact, "app:contacts.rejected")}
                >
                  {t("app:contacts.reject")}
                </Button>
              </div>
            );
          }
          if (tab === "sent") {
            return (
              <Button
                variant="tertiary"
                size="sm"
                aria-label={t("app:contacts.cancelOne", { name: who })}
                loading={removing && removingId === contact.id}
                onClick={() => void quick(removeContact, contact, "app:contacts.cancelled")}
              >
                {t("app:contacts.cancel")}
              </Button>
            );
          }
          if (tab === "blocked") {
            return (
              <Button
                variant="secondary"
                size="sm"
                aria-label={t("app:contacts.unblockOne", { name: who })}
                onFocus={rememberFocus}
                onClick={() => askConfirm("unblock", contact)}
              >
                {t("app:contacts.unblock")}
              </Button>
            );
          }
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="tertiary"
                  size="sm"
                  shape="square"
                  aria-label={t("app:contacts.rowActions", { name: who })}
                  onFocus={rememberFocus}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => askConfirm("remove", contact)}>
                  <UserMinus aria-hidden="true" />
                  {t("app:contacts.remove")}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => askConfirm("block", contact)}>
                  <Ban aria-hidden="true" />
                  {t("app:contacts.block")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
        meta: { align: "end" },
      }),
    ]);
  }, [
    t,
    i18n.language,
    tab,
    myId,
    quick,
    askConfirm,
    rememberFocus,
    acceptContact,
    rejectContact,
    removeContact,
    accepting,
    acceptingId,
    rejecting,
    rejectingId,
    removing,
    removingId,
  ]);

  const confirmText = confirming && {
    title: t(`app:contacts.${confirming.kind}Title`, { name: otherParty(confirming.contact, myId).name }),
    description: t(`app:contacts.${confirming.kind}Body`),
    action: t(`app:contacts.${confirming.kind}`),
  };

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("nav.contacts")} · ${t("brand.name")}`}</title>
      <PageHeader
        title={t("nav.contacts")}
        description={t("app:pages.contacts")}
        actions={
          <Button ref={addButtonRef} prefix={<UserPlus />} onClick={() => setAddOpen(true)}>
            {t("app:contacts.add")}
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(next) => setTab(next as ContactTab)} className="flex flex-col gap-4">
        <TabsList ref={tabsListRef} aria-label={t("nav.contacts")}>
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value} className="gap-2">
              {t(`app:contacts.tabs.${value}`)}
              {value === "received" && byTab.received.length > 0 && (
                <Badge size="sm" className="tabular-nums">
                  {byTab.received.length}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((value) => (
          <TabsContent key={value} value={value}>
            <DataTable
              columns={columns}
              data={contacts.data && byTab[value]}
              getRowId={(contact) => contact.id}
              isLoading={contacts.isPending}
              error={contacts.error}
              onRetry={() => void contacts.refetch()}
              search={{ column: "person", placeholder: t("app:users.search") }}
              emptyState={
                <EmptyState
                  icon={value === "blocked" ? Ban : ContactIcon}
                  title={t(`app:contacts.empty.${value}.title`)}
                  description={t(`app:contacts.empty.${value}.body`)}
                  action={
                    value === "accepted" && (
                      <Button variant="secondary" prefix={<UserPlus />} onClick={() => setAddOpen(true)}>
                        {t("app:contacts.add")}
                      </Button>
                    )
                  }
                />
              }
              pageSizeOptions={[20, 50, 100]}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* From the empty state, that button is gone once someone's added; the header's stays. */}
      <AddContactDialog open={addOpen} onOpenChange={setAddOpen} returnFocusTo={addButtonRef} />
      <ConfirmDelete
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmText?.title ?? ""}
        description={confirmText?.description ?? ""}
        actionLabel={confirmText?.action}
        errorText={t("app:contacts.actionError")}
        onConfirm={() => (confirming ? confirm(confirming) : undefined)}
        returnFocusTo={returnFocusRef}
      />
    </div>
  );
}
