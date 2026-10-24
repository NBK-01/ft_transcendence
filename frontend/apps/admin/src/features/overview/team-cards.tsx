import { Building2, Contact, Headset, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useConversations, useStaffAccess, useStaffSession } from "@trans/api";

import { useOrganizations } from "../branches/api";
import { useBranchFilter } from "../branches/use-branch-filter";
import { tabOf, useContacts } from "../contacts/api";
import { useInternalUsers } from "../users/api";
import { OverviewStat } from "./overview-stat";
import { queryState } from "./query-state";

/**
 * The team row. Each card shows only for the roles whose requests it needs, so
 * no role gets a 403: staff for admins, support conversations for
 * "chat:support:access", the rest for everyone.
 */
export function TeamCards() {
  const { t } = useTranslation("app");
  const { isAdmin, can } = useStaffAccess();
  return (
    <section className="flex flex-col gap-4" aria-labelledby="team-heading">
      <h2 id="team-heading" className="text-heading-20">
        {t("overview.team.title")}
      </h2>
      {/* One row from xl up, however many cards the role gets. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none">
        {isAdmin && <StaffCard />}
        <BranchesCard />
        <RequestsCard />
        {can("chat:support:access") && <SupportCard />}
      </div>
    </section>
  );
}

/** Active accounts in the filtered branch (or all), from the same list and filter as the Users page. */
function StaffCard() {
  const { t } = useTranslation("app");
  const staff = useInternalUsers();
  const organizations = useOrganizations();
  const { branchId, withBranch } = useBranchFilter();
  const branch = organizations.data?.find((org) => org.id === branchId);
  const active = staff.data?.filter((user) => user.isActive && (!branchId || user.organizationId === branchId));
  const state = queryState(staff);
  return (
    <OverviewStat
      to={withBranch("/users")}
      label={t("overview.team.staff")}
      icon={Users}
      value={active?.length}
      description={branch ? t("overview.inBranch", { branch: branch.name }) : t("overview.allBranches")}
      {...state}
      // With a branch picked, its name is part of the card.
      isLoading={state.isLoading || (branchId !== null && organizations.isPending)}
    />
  );
}

/** Every branch, whatever the filter: the filter picks one of them. */
function BranchesCard() {
  const { t } = useTranslation("app");
  const organizations = useOrganizations();
  const { withBranch } = useBranchFilter();
  const active = organizations.data?.filter((org) => org.isActive).length;
  const deactivated = (organizations.data?.length ?? 0) - (active ?? 0);
  return (
    <OverviewStat
      to={withBranch("/branches")}
      label={t("overview.team.branches")}
      icon={Building2}
      value={active}
      description={
        deactivated > 0 ? t("overview.team.deactivated", { count: deactivated }) : t("overview.team.noneDeactivated")
      }
      {...queryState(organizations)}
    />
  );
}

/** Requests waiting for your answer: yours, whatever the branch filter. Same count as the Contacts nav badge. */
function RequestsCard() {
  const { t } = useTranslation("app");
  const { user } = useStaffSession();
  const contacts = useContacts();
  const { withBranch } = useBranchFilter();
  const myId = user?.id ?? "";
  const waiting = contacts.data?.filter((contact) => tabOf(contact, myId) === "received").length;
  return (
    <OverviewStat
      to={withBranch("/contacts")}
      label={t("overview.team.requests")}
      icon={Contact}
      value={waiting}
      description={waiting ? t("overview.team.requestsWaiting") : t("overview.team.requestsNone")}
      {...queryState(contacts)}
    />
  );
}

/** Customer conversations aren't tied to a branch, so this one counts them all. */
function SupportCard() {
  const { t } = useTranslation("app");
  const conversations = useConversations();
  const { withBranch } = useBranchFilter();
  const support = conversations.data?.filter((conversation) => conversation.type === "support").length;
  return (
    <OverviewStat
      to={withBranch("/messages")}
      label={t("overview.team.support")}
      icon={Headset}
      value={support}
      description={t("overview.allBranches")}
      {...queryState(conversations)}
    />
  );
}
