import {
  checkSignature,
  computeSignature,
  parseSignatureHeader,
} from './signature';

const SECRET = 'carrier-secret-for-tests';
const NOW = 1_700_000_000;
const BODY = Buffer.from('{"eventId":"evt_1","type":"tracking.updated"}');

/** A header the way a carrier would build it. */
const signed = (timestamp = NOW, body = BODY, secret = SECRET) =>
  `t=${timestamp},v1=${computeSignature(secret, timestamp, body)}`;

describe('webhook signatures', () => {
  it('accepts a signature over the exact body, made with our secret, within 5 minutes', () => {
    expect(checkSignature(signed(), BODY, SECRET, NOW)).toBe('valid');
    expect(checkSignature(signed(NOW - 300), BODY, SECRET, NOW)).toBe('valid');
    expect(checkSignature(signed(NOW + 300), BODY, SECRET, NOW)).toBe('valid');
  });

  it('refuses a changed body, another secret, or another timestamp than the one signed', () => {
    const tampered = Buffer.from(BODY.toString().replace('evt_1', 'evt_2'));
    expect(checkSignature(signed(), tampered, SECRET, NOW)).toBe('mismatch');
    expect(checkSignature(signed(NOW, BODY, 'other'), BODY, SECRET, NOW)).toBe(
      'mismatch',
    );
    const v1 = computeSignature(SECRET, NOW, BODY);
    expect(checkSignature(`t=${NOW - 1},v1=${v1}`, BODY, SECRET, NOW)).toBe(
      'mismatch',
    );
  });

  it('refuses a replay older (or newer) than 5 minutes, even if correctly signed', () => {
    expect(checkSignature(signed(NOW - 301), BODY, SECRET, NOW)).toBe(
      'expired',
    );
    expect(checkSignature(signed(NOW + 301), BODY, SECRET, NOW)).toBe(
      'expired',
    );
  });

  it.each([
    undefined,
    '',
    'v1=abc',
    `t=${NOW}`,
    `t=12x,v1=${'a'.repeat(64)}`,
    `t=${NOW},v1=short`,
  ])('refuses a malformed header: %p', (header) => {
    expect(checkSignature(header, BODY, SECRET, NOW)).toBe('malformed');
  });

  it('reads the header with spaces around its parts, and v1 in any case', () => {
    const v1 = computeSignature(SECRET, NOW, BODY);
    expect(parseSignatureHeader(` t=${NOW} , v1=${v1.toUpperCase()} `)).toEqual(
      { timestamp: NOW, signature: v1 },
    );
  });
});
