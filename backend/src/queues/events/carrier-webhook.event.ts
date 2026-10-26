import { CarrierEventReceivedSignal } from '../../webhooks/webhook-signals';

/** Data of a CARRIER_WEBHOOK job: a logged carrier event to apply, and the delivery that queued it. */
export type CarrierWebhookEvent = CarrierEventReceivedSignal;
