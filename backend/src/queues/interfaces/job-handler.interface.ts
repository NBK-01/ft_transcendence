import { Job } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
import { NotificationsService } from '../../notifications/notifications.service';
import { ShipmentLookupService } from '../../notifications/shipment-lookup.service';

/** What the processor hands every handler. A new dependency goes here and in JobsProcessor. */
export interface JobServices {
  notificationsService: NotificationsService;
  shipmentLookupService: ShipmentLookupService;
  i18n: I18nService;
}

/** A job type's logic, looked up by job name in HANDLER_REGISTRY. */
export interface JobHandler<TData> {
  /** The work. Throw to have BullMQ retry it, up to the definition's attempts. */
  run(job: Job<TData>, services: JobServices): Promise<unknown>;
  /** Called once, after the last attempt failed. */
  onFinalFailure?(job: Job<TData>, services: JobServices): Promise<void>;
}
