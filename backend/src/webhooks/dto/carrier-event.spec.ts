import { HttpStatus } from '@nestjs/common';
import { WebhookErrorCodes } from '../exceptions';
import { parseCarrierEnvelope, parseTrackingUpdate } from './carrier-event';

const expectInvalid = (parse: () => unknown) => {
  try {
    parse();
  } catch (error) {
    expect(error).toMatchObject({
      code: WebhookErrorCodes.InvalidWebhookPayload,
    });
    expect((error as { getStatus(): number }).getStatus()).toBe(
      HttpStatus.BAD_REQUEST,
    );
    return;
  }
  throw new Error('Expected the payload to be refused');
};

describe('carrier event payloads', () => {
  it('reads the envelope, and keeps fields it doesn’t know about out of the way', () => {
    expect(
      parseCarrierEnvelope({
        eventId: ' evt_1 ',
        type: 'tracking.updated',
        data: { anything: true },
        addedLater: 'by the carrier',
      }),
    ).toEqual({
      eventId: 'evt_1',
      type: 'tracking.updated',
      data: { anything: true },
    });
  });

  it.each([
    null,
    [],
    'text',
    { type: 'x' },
    { eventId: '', type: 'x' },
    { eventId: 'e' },
  ])('refuses an envelope like %p (400, 6003)', (body) =>
    expectInvalid(() => parseCarrierEnvelope(body)),
  );

  it('reads a tracking update, upper-casing the tracking ID', () => {
    expect(
      parseTrackingUpdate({
        trackingId: ' trk-4a6f90 ',
        status: 'out_for_delivery',
        location: ' Paris depot ',
      }),
    ).toEqual({
      trackingId: 'TRK-4A6F90',
      status: 'out_for_delivery',
      location: 'Paris depot',
    });
  });

  it.each([
    undefined,
    { status: 'in_transit', location: 'x' },
    { trackingId: 'TRK-1', status: 'cancelled', location: 'x' },
    { trackingId: 'TRK-1', status: 'in_transit', location: '' },
    { trackingId: 'TRK-1', status: 'in_transit', location: 'x'.repeat(201) },
  ])('refuses a tracking update like %p (400, 6003)', (data) =>
    expectInvalid(() => parseTrackingUpdate(data)),
  );
});
