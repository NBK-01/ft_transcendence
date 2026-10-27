import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useContactPresence, useStaffSession, type Conversation } from "@trans/api";

import { otherParty, useContacts } from "../contacts/api";

export type ConversationTitle = {
  name: string;
  /** Shown under the name: the person's email, or the customer's short id. */
  detail: string;
  /** The other staff member in a DM. */
  otherId?: string;
  /** Whether they're online; undefined unless they're an accepted contact. */
  online?: boolean;
  support: boolean;
};

/**
 * Names for conversations. The API only gives ids, so a DM's other person comes
 * from your contacts ("Former contact" once removed), and a support
 * conversation is "Customer" plus a short id until the backend sends names.
 */
export function useConversationTitle() {
  const { t } = useTranslation("app");
  const { user } = useStaffSession();
  const contacts = useContacts();
  const presence = useContactPresence().data;
  const myId = user?.id ?? "";

  return useMemo(() => {
    const people = new Map<string, { name: string; email: string }>();
    for (const contact of contacts.data ?? []) {
      const person = otherParty(contact, myId);
      people.set(person.id, person);
    }
    return (conversation: Conversation): ConversationTitle => {
      if (conversation.type === "support") {
        return { name: t("messages.customer"), detail: `#${conversation.customerId?.slice(0, 8) ?? ""}`, support: true };
      }
      const otherId = (conversation.participantAId === myId ? conversation.participantBId : conversation.participantAId) ?? undefined;
      const person = otherId ? people.get(otherId) : undefined;
      return {
        name: person?.name ?? t("messages.formerContact"),
        detail: person?.email ?? "",
        otherId,
        online: otherId ? presence?.get(otherId) : undefined,
        support: false,
      };
    };
  }, [contacts.data, presence, myId, t]);
}
