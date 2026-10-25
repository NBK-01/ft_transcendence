import { Queue } from 'bullmq';
import { JobType } from '../constants/job-type';
import { QueueService } from './queue.service';

describe('QueueService.enqueue', () => {
  const add = jest.fn().mockResolvedValue({ id: 'job' });
  const service = new QueueService({ add } as unknown as Queue);

  beforeEach(() => add.mockClear());

  it('adds the job with everything taken from its definition', async () => {
    await service.enqueue(JobType.SHIPMENT_EVENT_NOTIFICATION, {
      shipmentEventId: 'event-1',
    });

    expect(add).toHaveBeenCalledWith(
      'SHIPMENT_EVENT_NOTIFICATION',
      { shipmentEventId: 'event-1' },
      {
        jobId: 'SHIPMENT_EVENT_NOTIFICATION-event-1',
        // BullMQ's attempts is the total: the definition's 5, not 5 retries.
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 24 * 60 * 60 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    );
  });

  it('gives the same event the same job id, so BullMQ adds it once', async () => {
    const data = { shipmentEventId: 'event-1' };
    await service.enqueue(JobType.SHIPMENT_EVENT_NOTIFICATION, data);
    await service.enqueue(JobType.SHIPMENT_EVENT_NOTIFICATION, data);

    const [first, second] = add.mock.calls.map(
      (call) => (call as [string, unknown, { jobId: string }])[2].jobId,
    );
    expect(first).toBe(second);
  });
});
