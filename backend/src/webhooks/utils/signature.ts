import { createHmac } from 'crypto';
import { timingSafeCompare } from '../../public-api/utils/timing-safe-compare';
import { REPLAY_WINDOW_SECONDS } from '../constants/webhook.constants';

export type SignatureCheck = 'valid' | 'malformed' | 'expired' | 'mismatch';

/** "t=1700000000, v1=ab12…" → its parts, or null. Spaces around parts are allowed; the timestamp must be whole seconds. */
export function parseSignatureHeader(
  header: string | undefined,
): { timestamp: number; signature: string } | null {
  if (!header) {
    return null;
  }
  const parts = new Map(
    header.split(',').map((part) => {
      const [key = '', ...rest] = part.trim().split('=');
      return [key, rest.join('=')] as const;
    }),
  );
  const t = parts.get('t');
  const v1 = parts.get('v1');
  if (!t || !/^\d+$/.test(t) || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) {
    return null;
  }
  return { timestamp: Number(t), signature: v1.toLowerCase() };
}

/** HMAC-SHA256(secret, "{timestamp}.{raw body}"), in hex: what the sender puts in v1. */
export function computeSignature(
  secret: string,
  timestamp: number,
  rawBody: Buffer,
): string {
  return createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
    .digest('hex');
}

/**
 * Stripe-style check over the exact bytes received (not re-serialised
 * JSON): the header must parse, be within REPLAY_WINDOW_SECONDS of now
 * (either way), and match in constant time.
 */
export function checkSignature(
  header: string | undefined,
  rawBody: Buffer,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): SignatureCheck {
  const parsed = parseSignatureHeader(header);
  if (!parsed) {
    return 'malformed';
  }
  if (Math.abs(nowSeconds - parsed.timestamp) > REPLAY_WINDOW_SECONDS) {
    return 'expired';
  }
  const expected = computeSignature(secret, parsed.timestamp, rawBody);
  return timingSafeCompare(parsed.signature, expected) ? 'valid' : 'mismatch';
}
