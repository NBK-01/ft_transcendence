import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { JobType } from '../constants/job-type';
import { QueueName } from '../constants/queue-name';
import { JobDataMap } from '../interfaces/job-data.interface';
import { generateJobId, JOB_REGISTRY } from '../registry/job-registry';

/**
 * The only way to enqueue a job: everything about it (queue, id, retries,
 * retention) comes from its registry definition, never from the caller.
 */
@Injectable()
export class QueueService {
  private readonly queues: Record<QueueName, Queue>;

  constructor(@InjectQueue(QueueName.STANDARD) standardQueue: Queue) {
    this.queues = { [QueueName.STANDARD]: standardQueue };
  }

  /** Enqueuing the same job type and data again is a no-op while BullMQ keeps the first job. */
  async enqueue<K extends JobType>(
    type: K,
    data: JobDataMap[K],
  ): Promise<Job<JobDataMap[K]>> {
    const definition = JOB_REGISTRY[type];
    return this.queues[definition.queue].add(type, data, {
      jobId: generateJobId(type, data),
      attempts: definition.attempts,
      backoff: definition.backoff,
      removeOnComplete: definition.removeOnComplete,
      removeOnFail: definition.removeOnFail,
    }) as Promise<Job<JobDataMap[K]>>;
  }
}
