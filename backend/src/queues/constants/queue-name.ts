/**
 * BullMQ queues, each with its own worker. A job picks its queue in its
 * definition. To add a queue: a value here, a processor class for it (see
 * StandardJobsProcessor) and a constructor parameter in QueueService.
 */
export enum QueueName {
  STANDARD = 'standard',
}
