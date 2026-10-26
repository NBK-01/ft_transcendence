import { timingSafeEqual } from 'crypto';

/**
 * Compares two secrets in constant time. crypto.timingSafeEqual throws when
 * the lengths differ, and returning early would tell an attacker the
 * secret's length, so a length mismatch still runs one comparison (of `a`
 * with itself) before saying no.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
