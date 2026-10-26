import { JobType } from '../constants/job-type';
import { QueueName } from '../constants/queue-name';
import { UnknownJobTypeException } from '../exceptions';
import { HANDLER_REGISTRY, handlerFor } from './handler-registry';
import { generateJobId, JOB_REGISTRY } from './job-registry';

const EVENT_ID = '2f1c9a52-8a0b-4c55-9d6f-1f0c3e2b7a10';

describe('job registry', () => {
  it.each(Object.values(JobType))(
    '%s has a definition and a handler',
    (type) => {
      const definition = JOB_REGISTRY[type];
      expect(definition.name).toBe(type);
      expect(Object.values(QueueName)).toContain(definition.queue);
      expect(definition.attempts).toBeGreaterThanOrEqual(1);
      expect(typeof HANDLER_REGISTRY[type].run).toBe('function');
    },
  );

  it('gives the shipment notification job 5 runs in all (1 try + 4 retries)', () => {
    expect(JOB_REGISTRY[JobType.SHIPMENT_EVENT_NOTIFICATION].attempts).toBe(5);
  });
});

describe('generateJobId', () => {
  const type = JobType.SHIPMENT_EVENT_NOTIFICATION;

  it('is the same for the same event, every time', () => {
    expect(generateJobId(type, { shipmentEventId: EVENT_ID })).toBe(
      generateJobId(type, { shipmentEventId: EVENT_ID }),
    );
    expect(generateJobId(type, { shipmentEventId: EVENT_ID })).toBe(
      `SHIPMENT_EVENT_NOTIFICATION-${EVENT_ID}`,
    );
  });

  it('differs between events', () => {
    expect(generateJobId(type, { shipmentEventId: EVENT_ID })).not.toBe(
      generateJobId(type, { shipmentEventId: 'another-event' }),
    );
  });

  it('is an id BullMQ accepts: no colon, not a number', () => {
    const id = generateJobId(type, { shipmentEventId: EVENT_ID });
    expect(id).not.toContain(':');
    expect(Number.isInteger(Number(id))).toBe(false);
  });
});

describe('handlerFor', () => {
  it('finds the handler by job name', () => {
    expect(handlerFor(JobType.SHIPMENT_EVENT_NOTIFICATION)).toBe(
      HANDLER_REGISTRY[JobType.SHIPMENT_EVENT_NOTIFICATION],
    );
  });

  it('refuses a name with no handler', () => {
    expect(() => handlerFor('SOMETHING_ELSE')).toThrow(UnknownJobTypeException);
  });
});
