import { KeepJobs } from 'bullmq';
import { JobType } from '../constants/job-type';
import { QueueName } from '../constants/queue-name';

/** A job type's registry entry: where it runs, how it retries, how long BullMQ keeps it. */
export interface JobDefinition<TData> {
  name: JobType;
  queue: QueueName;
  /** Total runs, the first one included (BullMQ's meaning): 5 = 1 try + 4 retries. */
  attempts: number;
  /** The wait before each retry; exponential doubles it every time. */
  backoff: { type: 'exponential' | 'fixed'; delay: number };
  /**
   * Builds the job id from the data alone (no clock, no randomness), so the
   * same job enqueued twice is added once while BullMQ still keeps the
   * first (see the retention below). Must not contain ':' (BullMQ refuses it).
   */
  jobId: (data: TData) => string;
  removeOnComplete: KeepJobs;
  removeOnFail: KeepJobs;
}
