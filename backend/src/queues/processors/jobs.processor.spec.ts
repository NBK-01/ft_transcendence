import { Job } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
import { NotificationsService } from '../../notifications/notifications.service';
import { ShipmentLookupService } from '../../notifications/shipment-lookup.service';
import { ActionLookupService } from '../../notifications/action-lookup.service';
import { WebhooksService } from '../../webhooks/webhooks.service';
import { JobType } from '../constants/job-type';
import { UnknownJobTypeException } from '../exceptions';
import { StandardJobsProcessor } from './standard-jobs.processor';

describe('JobsProcessor', () => {
  const markPendingFailed = jest.fn().mockResolvedValue(0);
  const processor = new StandardJobsProcessor(
    { markPendingFailed } as unknown as NotificationsService,
    {} as ShipmentLookupService,
    {} as ActionLookupService,
    {} as WebhooksService,
    {} as I18nService,
  );

  /** A SHIPMENT_EVENT_NOTIFICATION job, as BullMQ hands it over after `attemptsMade` failed runs. */
  const failedJob = (attemptsMade: number) =>
    ({
      id: 'SHIPMENT_EVENT_NOTIFICATION-event-1',
      name: JobType.SHIPMENT_EVENT_NOTIFICATION,
      data: { shipmentEventId: 'event-1' },
      opts: { attempts: 5 },
      attemptsMade,
    }) as Job;

  beforeEach(() => {
    markPendingFailed.mockClear();
    jest.spyOn(processor['logger'], 'warn').mockImplementation(() => {});
  });

  it('leaves the rows alone while a retry is still coming', async () => {
    await processor.onFailed(failedJob(4), new Error('boom'));

    expect(markPendingFailed).not.toHaveBeenCalled();
  });

  it("runs the handler's final-failure step after the last attempt", async () => {
    await processor.onFailed(failedJob(5), new Error('boom'));

    expect(markPendingFailed).toHaveBeenCalledWith('shipment-event:event-1:');
  });

  it('refuses a job whose name has no handler', async () => {
    await expect(
      processor.process({ name: 'SOMETHING_ELSE', data: {} } as Job),
    ).rejects.toBeInstanceOf(UnknownJobTypeException);
  });
});
