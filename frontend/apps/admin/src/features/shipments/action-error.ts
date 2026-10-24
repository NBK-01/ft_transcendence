import { INVALID_SHIPMENT_STATE, isApiError, isForbidden } from "@trans/api";

/**
 * A failed shipment change, as text for the form's root error (not a key):
 *  - 403: ours; the role changed since signing in (the backend's message is English-only).
 *  - 409 (3002): ours; someone moved the shipment first. The hook has already
 *    refetched it, so the page behind the dialog shows where it is now.
 *  - anything else the backend explains (a 400's checks): its messages,
 *    already translated, one per line.
 *  - no answer: `fallback`.
 */
export function actionError(error: unknown, t: (key: string) => string, fallback: string) {
  if (isForbidden(error)) return t("app:noAccess.action");
  if (!isApiError(error)) return t(fallback);
  if (error.errorCode === INVALID_SHIPMENT_STATE) return t("app:shipment.changed");
  return error.messages.length > 0 ? error.messages.join("\n") : t(fallback);
}
