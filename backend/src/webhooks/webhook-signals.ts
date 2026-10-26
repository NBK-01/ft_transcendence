/**
 * Emitted (emitAsync) by WebhooksService once a delivery is logged.
 * QueuesModule's WebhookSignalsListener enqueues the job; it doesn't
 * suppress errors, so a failed enqueue fails the request and the provider
 * redelivers. An event, not a direct call, because the queue's worker calls
 * back into WebhooksService: a direct dependency would be a module cycle.
 */
export const WebhookSignals = {
  CARRIER_EVENT_RECEIVED: 'webhook.carrier-event-received',
} as const;

export interface CarrierEventReceivedSignal {
  /** The event's first delivery: the row that's processed. */
  webhookLogId: string;
  /** This delivery's row: the job's id, so a redelivery can queue the event again. */
  deliveryId: string;
}
