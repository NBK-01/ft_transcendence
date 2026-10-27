import { I18nService } from 'nestjs-i18n';
import { AccountType } from '../../common/context/auth-context.types';
import { ShipmentActorType } from '../../shipments/constants/shipment-actor';
import { ShipmentState } from '../../shipments/constants/shipment-state';
import { NotificationType } from '../../notifications/constants/notification.constants';
import { NotificationRecipient } from '../../notifications/notifications.service';
import { ShipmentEventSummary } from '../../notifications/shipment-lookup.service';
import { ShipmentEventNotificationEvent } from '../events/shipment-event-notification.event';
import { JobHandler, JobServices } from '../interfaces/job-handler.interface';
import { notifyOnce } from './notify-once';

/**
 * Who to tell about an event from before its actor was recorded: the side
 * that didn't cause it, read from the status. Back then each status had one
 * writer: the customer moved a shipment to pending_sourcing (a request or a
 * rejected offer), pending_payment and pending_payment_confirmation; staff
 * wrote every other step. audiencesFor reads the actor first.
 */
export const AUDIENCE_BY_STATUS: Record<ShipmentState, AccountType | null> = {
  [ShipmentState.PENDING_SOURCING]: AccountType.STAFF,
  [ShipmentState.PENDING_CLIENT_DECISION]: AccountType.CUSTOMER,
  [ShipmentState.PENDING_PAYMENT]: AccountType.STAFF,
  [ShipmentState.PENDING_PAYMENT_CONFIRMATION]: AccountType.STAFF,
  // Nothing writes it (see ShipmentState).
  [ShipmentState.REQUESTED]: null,
  [ShipmentState.CONFIRMED]: AccountType.CUSTOMER,
  [ShipmentState.IN_TRANSIT]: AccountType.CUSTOMER,
  [ShipmentState.OUT_FOR_DELIVERY]: AccountType.CUSTOMER,
  [ShipmentState.DELIVERED]: AccountType.CUSTOMER,
  [ShipmentState.CANCELLED]: AccountType.CUSTOMER,
};

/**
 * Who to tell: the side that didn't act. A partner (public API) or the
 * carrier (webhook) is neither side, so both hear about it.
 */
export function audiencesFor(
  event: Pick<ShipmentEventSummary, 'status' | 'actorType'>,
): AccountType[] {
  switch (event.actorType) {
    case ShipmentActorType.CUSTOMER:
      return [AccountType.STAFF];
    case ShipmentActorType.STAFF:
      return [AccountType.CUSTOMER];
    case ShipmentActorType.PARTNER:
    case ShipmentActorType.CARRIER:
      return [AccountType.CUSTOMER, AccountType.STAFF];
    default: {
      const audience = AUDIENCE_BY_STATUS[event.status];
      return audience ? [audience] : [];
    }
  }
}

/** Every row this job creates starts with it, which is how onFinalFailure finds them. */
export function dedupeKeyPrefix(shipmentEventId: string): string {
  return `shipment-event:${shipmentEventId}:`;
}

function dedupeKey(
  shipmentEventId: string,
  recipient: NotificationRecipient,
): string {
  return `${dedupeKeyPrefix(shipmentEventId)}${recipient.accountType}:${recipient.id}`;
}

/**
 * A shipment created straight at `confirmed` (by a partner, through the
 * public API): it's told as a new shipment, not a confirmed payment.
 */
export function isNewShipment(
  event: Pick<ShipmentEventSummary, 'status' | 'isFirstEvent'>,
): boolean {
  return event.isFirstEvent && event.status === ShipmentState.CONFIRMED;
}

/**
 * What the person who moved it did, as their copy says it: a new request and
 * a rejected offer both go back to pending_sourcing.
 */
function actorStep(
  event: Pick<ShipmentEventSummary, 'status' | 'isFirstEvent'>,
): string {
  if (event.status === ShipmentState.PENDING_SOURCING) {
    return event.isFirstEvent ? 'requested' : 'rejected';
  }
  return event.status;
}

/**
 * English copy from i18n/en/notifications.json, worded for the audience, or
 * for the person who acted ("You…").
 */
export function shipmentUpdateCopy(
  i18n: I18nService,
  audience: AccountType | 'actor',
  event: Pick<ShipmentEventSummary, 'status' | 'trackingId' | 'isFirstEvent'>,
): { title: string; message: string } {
  const step =
    audience === 'actor'
      ? actorStep(event)
      : isNewShipment(event)
        ? 'created'
        : event.status;
  const key = `notifications.${NotificationType.SHIPMENT_UPDATE}.${audience}.${step}`;
  const options = { lang: 'en', args: { trackingId: event.trackingId } };
  return {
    title: i18n.translate(`${key}.title`, options),
    message: i18n.translate(`${key}.message`, options),
  };
}

/** The person who moved it, who gets a record of it; a partner or the carrier isn't one. */
function actorOf(event: ShipmentEventSummary): NotificationRecipient | null {
  if (!event.actorId) {
    return null;
  }
  switch (event.actorType) {
    case ShipmentActorType.CUSTOMER:
      return { id: event.actorId, accountType: AccountType.CUSTOMER };
    case ShipmentActorType.STAFF:
      return { id: event.actorId, accountType: AccountType.STAFF };
    default:
      return null;
  }
}

interface Notified {
  recipient: NotificationRecipient;
  copy: { title: string; message: string };
  /** The recipient is the one who acted. */
  ownAction: boolean;
}

/** The actor first, then each audience; each person once, and only while their account is active. */
async function notifiedFor(
  event: ShipmentEventSummary,
  services: JobServices,
): Promise<Notified[]> {
  const notified: Notified[] = [];
  const actor = actorOf(event);
  if (actor) {
    const copy = shipmentUpdateCopy(services.i18n, 'actor', event);
    notified.push({ recipient: actor, copy, ownAction: true });
  }
  for (const audience of audiencesFor(event)) {
    const copy = shipmentUpdateCopy(services.i18n, audience, event);
    const recipients =
      audience === AccountType.CUSTOMER
        ? [{ id: event.clientId, accountType: AccountType.CUSTOMER }]
        : await services.shipmentLookupService.findShipmentStaff();
    for (const recipient of recipients) {
      notified.push({ recipient, copy, ownAction: false });
    }
  }
  const keyOf = ({ accountType, id }: NotificationRecipient) =>
    `${accountType}:${id}`;
  const active = new Set(
    (
      await services.actionLookupService.keepActive(
        notified.map(({ recipient }) => recipient),
      )
    ).map(keyOf),
  );
  const seen = new Set<string>();
  return notified.filter(({ recipient }) => {
    const key = keyOf(recipient);
    const keep = active.has(key) && !seen.has(key);
    seen.add(key);
    return keep;
  });
}

export const shipmentEventNotificationHandler: JobHandler<ShipmentEventNotificationEvent> =
  {
    async run(job, services) {
      const event = await services.shipmentLookupService.findEvent(
        job.data.shipmentEventId,
      );
      // No event: deleted with its shipment before the job ran.
      if (!event) {
        return { recipients: 0, delivered: 0 };
      }

      const payload = {
        trackingId: event.trackingId,
        status: event.status,
        ...(isNewShipment(event) && { isNew: true as const }),
        ...(event.actorType && { actorType: event.actorType }),
      };
      const notified = await notifiedFor(event, services);
      let delivered = 0;
      for (const { recipient, copy, ownAction } of notified) {
        const sent = await notifyOnce(services, {
          recipient,
          type: NotificationType.SHIPMENT_UPDATE,
          payload,
          ...copy,
          dedupeKey: dedupeKey(event.id, recipient),
          ownAction,
        });
        delivered += Number(sent);
      }
      return { recipients: notified.length, delivered };
    },

    async onFinalFailure(job, services) {
      await services.notificationsService.markPendingFailed(
        dedupeKeyPrefix(job.data.shipmentEventId),
      );
    },
  };
