import {
  CARRIER_TRACKING_STATUSES,
  CARRIER_TRACKING_UPDATED,
  CarrierTrackingStatus,
} from '../constants/webhook.constants';
import { InvalidWebhookPayloadException } from '../exceptions';

/** Every carrier delivery: an id we can deduplicate on, and what happened. */
export interface CarrierEnvelope {
  /** The carrier's id for this event; the same on every redelivery. */
  eventId: string;
  type: string;
  data: unknown;
}

/** `tracking.updated`: a parcel moved. */
export interface CarrierTrackingUpdate {
  trackingId: string;
  status: CarrierTrackingStatus;
  location: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

/**
 * Checked by hand rather than with a DTO: the app's ValidationPipe refuses
 * unknown fields, so a field the carrier adds later would turn every
 * delivery into a 400. Only what we use is checked.
 */
export function parseCarrierEnvelope(body: unknown): CarrierEnvelope {
  if (!isRecord(body)) {
    throw new InvalidWebhookPayloadException('the body must be a JSON object');
  }
  if (!text(body.eventId, 100)) {
    throw new InvalidWebhookPayloadException(
      'eventId must be a string of 1 to 100 characters',
    );
  }
  if (!text(body.type, 100)) {
    throw new InvalidWebhookPayloadException('type must be a string');
  }
  return { eventId: body.eventId.trim(), type: body.type, data: body.data };
}

export function parseTrackingUpdate(data: unknown): CarrierTrackingUpdate {
  if (!isRecord(data)) {
    throw new InvalidWebhookPayloadException(
      `data must be an object for ${CARRIER_TRACKING_UPDATED}`,
    );
  }
  if (!text(data.trackingId, 50)) {
    throw new InvalidWebhookPayloadException('data.trackingId is missing');
  }
  if (
    !CARRIER_TRACKING_STATUSES.includes(data.status as CarrierTrackingStatus)
  ) {
    throw new InvalidWebhookPayloadException(
      `data.status must be one of ${CARRIER_TRACKING_STATUSES.join(', ')}`,
    );
  }
  if (!text(data.location, 200)) {
    throw new InvalidWebhookPayloadException(
      'data.location must be a string of 1 to 200 characters',
    );
  }
  return {
    trackingId: data.trackingId.trim().toUpperCase(),
    status: data.status as CarrierTrackingStatus,
    location: data.location.trim(),
  };
}
