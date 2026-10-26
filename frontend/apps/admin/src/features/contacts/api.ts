import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, keys, type Contact, type MessageResponse } from "@trans/api";

/** Backend ContactErrorCodes the screens react to (12000-12999, reassigned from 10000-10999). */
export const CONTACT_ALREADY_EXISTS = 12002;
export const CONTACT_SCOPE_VIOLATION = 12003;
export const CONTACT_NOT_PENDING = 12005;

/** GET /contacts: every contact you're part of, in any state. The tabs split it in the browser. */
export function useContacts() {
  return useQuery({
    queryKey: keys.contacts.list(),
    queryFn: ({ signal }) => api.get<Contact[]>("/contacts", { signal }),
  });
}

/** A mutation that refreshes the contacts list afterwards, whether it worked or not (it may be stale). */
function useContactMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.contacts.all }),
  });
}

/** POST /contacts. 403 (12003) outside your branch unless one of you is an admin; 409 (12002) if already connected. */
export const useSendContactRequest = () =>
  useContactMutation((addresseeId: string) => api.post<Contact>("/contacts", { addresseeId }));

/** PATCH /contacts/:id/accept. Only the addressee; 409 (12005) if the request was withdrawn meanwhile. */
export const useAcceptContact = () =>
  useContactMutation((id: string) => api.patch<Contact>(`/contacts/${encodeURIComponent(id)}/accept`));

/** PATCH /contacts/:id/reject: deletes the request. */
export const useRejectContact = () =>
  useContactMutation((id: string) => api.patch<MessageResponse>(`/contacts/${encodeURIComponent(id)}/reject`));

/** PATCH /contacts/:id/block. Either side; the backend doesn't record who blocked. */
export const useBlockContact = () =>
  useContactMutation((id: string) => api.patch<Contact>(`/contacts/${encodeURIComponent(id)}/block`));

/** DELETE /contacts/:id: removes a contact, cancels a sent request or lifts a block. */
export const useRemoveContact = () =>
  useContactMutation((id: string) => api.delete<MessageResponse>(`/contacts/${encodeURIComponent(id)}`));

export type ContactTab = "accepted" | "received" | "sent" | "blocked";

/** Which tab a contact belongs in, from the signed-in person's side. */
export function tabOf(contact: Contact, myId: string): ContactTab {
  if (contact.status === "pending") return contact.addresseeId === myId ? "received" : "sent";
  return contact.status;
}

/** The other person in a contact. */
export function otherParty(contact: Contact, myId: string) {
  return contact.requesterId === myId
    ? { id: contact.addresseeId, name: contact.addresseeName, email: contact.addresseeEmail }
    : { id: contact.requesterId, name: contact.requesterName, email: contact.requesterEmail };
}
