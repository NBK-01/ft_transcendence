import { Injectable, Logger } from '@nestjs/common';
import { OnWorkerEvent, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
import { NotificationsService } from '../../notifications/notifications.service';
import { ShipmentLookupService } from '../../notifications/shipment-lookup.service';
import { ActionLookupService } from '../../notifications/action-lookup.service';
import { WebhooksService } from '../../webhooks/webhooks.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { JobServices } from '../interfaces/job-handler.interface';
import { handlerFor } from '../registry/handler-registry';

/**
 * What every queue's worker does: run the handler the job's name points to,
 * and give it a last word when the job runs out of attempts. Each queue gets
 * a subclass carrying its own @Processor(), e.g. StandardJobsProcessor.
 */
@Injectable()
export abstract class JobsProcessor extends WorkerHost {
  protected readonly logger = new Logger(this.constructor.name);

  // eslint-disable-next-line max-params
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly shipmentLookupService: ShipmentLookupService,
    private readonly actionLookupService: ActionLookupService,
    private readonly webhooksService: WebhooksService,
    private readonly i18n: I18nService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    return handlerFor(job.name).run(job, this.services());
  }

  /** Fires after every failed attempt; only the last one (no retry left) is final. */
  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error): Promise<void> {
    if (!job) {
      return;
    }
    const attempts = job.opts.attempts ?? 1;
    this.logger.warn(
      `Job ${job.name} ${job.id} failed (attempt ${job.attemptsMade} of ${attempts}): ${error.message}`,
    );
    if (job.attemptsMade < attempts) {
      return;
    }
    try {
      await handlerFor(job.name).onFinalFailure?.(job, this.services());
    } catch (cleanupError) {
      this.logger.error(
        `Final-failure step of job ${job.name} ${job.id} failed: ${String(cleanupError)}`,
      );
    }
  }

  private services(): JobServices {
    return {
      notificationsService: this.notificationsService,
      shipmentLookupService: this.shipmentLookupService,
      actionLookupService: this.actionLookupService,
      webhooksService: this.webhooksService,
      notificationsGateway: this.notificationsGateway,
      i18n: this.i18n,
    };
  }
}
