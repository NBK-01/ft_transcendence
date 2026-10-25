import { Processor } from '@nestjs/bullmq';
import { QueueName } from '../constants/queue-name';
import { JobsProcessor } from './jobs.processor';

@Processor(QueueName.STANDARD, { concurrency: 10 })
export class StandardJobsProcessor extends JobsProcessor {}
