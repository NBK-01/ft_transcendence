import { I18nService } from 'nestjs-i18n';
import { AccountType } from '../../common/context/auth-context.types';
import { ShipmentState } from '../../shipments/constants/shipment-state';
import { NotificationType } from '../../notifications/constants/notification.constants';
import { NotificationRecipient } from '../../notifications/notifications.service';
import { ShipmentEventSummary } from '../../notifications/shipment-lookup.service';
import { ShipmentEventNotificationEvent } from '../events/shipment-event-notification.event';
import { JobHandler, JobServices } from '../interfaces/job-handler.interface';
import { notifyOnce } from './notify-once';

/**
 * Who to tell about each status: the side that didn't cause it. Today every
 * status is written by exactly one side, so the status alone says who acted:
 *  - the customer, in ShipmentsService: a new request or a rejected offer
 *    (pending_sourcing), an accepted offer (pending_payment), a submitted
 *    payment (pending_payment_confirmation) → tell the staff;
 *  - staff, in AdminShipmentsService: an offer (pending_client_decision), a
 *    confirmed payment (confirmed), tracking updates and cancellations
 *    (CreateEventDto) → tell the customer.
 * If a status ever becomes reachable from both sides (say, a customer
 * cancelling), this map can't tell them apart any more: read the event's
 * actorType (recorded on every event since ShipmentEventActor) instead.
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
 * public API): its customer hears about a new shipment, not a payment.
 */
export function isNewShipment(
  event: Pick<ShipmentEventSummary, 'status' | 'isFirstEvent'>,
): boolean {
  return event.isFirstEvent && event.status === ShipmentState.CONFIRMED;
}

/** English copy from i18n/en/notifications.json, worded for the audience. */
export function shipmentUpdateCopy(
  i18n: I18nService,
  audience: AccountType,
  event: Pick<ShipmentEventSummary, 'status' | 'trackingId' | 'isFirstEvent'>,
): { title: string; message: string } {
  const step = isNewShipment(event) ? 'created' : event.status;
  const key = `notifications.${NotificationType.SHIPMENT_UPDATE}.${audience}.${step}`;
  const options = { lang: 'en', args: { trackingId: event.trackingId } };
  return {
    title: i18n.translate(`${key}.title`, options),
    message: i18n.translate(`${key}.message`, options),
  };
}

async function recipientsFor(
  audience: AccountType,
  event: ShipmentEventSummary,
  services: JobServices,
): Promise<NotificationRecipient[]> {
  if (audience === AccountType.CUSTOMER) {
    return [{ id: event.clientId, accountType: AccountType.CUSTOMER }];
  }
  return services.shipmentLookupService.findShipmentStaff();
}

export const shipmentEventNotificationHandler: JobHandler<ShipmentEventNotificationEvent> =
  {
    async run(job, services) {
      const event = await services.shipmentLookupService.findEvent(
        job.data.shipmentEventId,
      );
      // No event: deleted with its shipment before the job ran.
      // No audience: a status nothing writes (see AUDIENCE_BY_STATUS).
      const audience = event && AUDIENCE_BY_STATUS[event.status];
      if (!event || !audience) {
        return { recipients: 0, delivered: 0 };
      }

      const recipients = await recipientsFor(audience, event, services);
      const copy = shipmentUpdateCopy(services.i18n, audience, event);
      let delivered = 0;
      for (const recipient of recipients) {
        const sent = await notifyOnce(services, {
          recipient,
          type: NotificationType.SHIPMENT_UPDATE,
          payload: {
            trackingId: event.trackingId,
            status: event.status,
            ...(isNewShipment(event) && { isNew: true }),
          },
          ...copy,
          dedupeKey: dedupeKey(event.id, recipient),
        });
        delivered += Number(sent);
      }
      return { recipients: recipients.length, delivered };
    },

    async onFinalFailure(job, services) {
      await services.notificationsService.markPendingFailed(
        dedupeKeyPrefix(job.data.shipmentEventId),
      );
    },
  };
