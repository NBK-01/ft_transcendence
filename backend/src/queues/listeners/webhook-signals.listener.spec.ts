import { JobType } from '../constants/job-type';
import { QueueService } from '../services/queue.service';
import { WebhookSignalsListener } from './webhook-signals.listener';

describe('WebhookSignalsListener', () => {
  it('queues one CARRIER_WEBHOOK job per delivery', async () => {
    const enqueue = jest.fn().mockResolvedValue({});
    const listener = new WebhookSignalsListener({
      enqueue,
    } as unknown as QueueService);

    await listener.onCarrierEventReceived({
      webhookLogId: 'log-1',
      deliveryId: 'log-2',
    });

    expect(enqueue).toHaveBeenCalledWith(JobType.CARRIER_WEBHOOK, {
      webhookLogId: 'log-1',
      deliveryId: 'log-2',
    });
  });

  it('lets a failed enqueue through to the request, so the carrier redelivers', async () => {
    const listener = new WebhookSignalsListener({
      enqueue: jest.fn().mockRejectedValue(new Error('Redis is down')),
    } as unknown as QueueService);

    await expect(
      listener.onCarrierEventReceived({
        webhookLogId: 'log-1',
        deliveryId: 'log-1',
      }),
    ).rejects.toThrow('Redis is down');
  });
});
