import * as crypto from 'crypto';
import { timingSafeCompare } from './timing-safe-compare';

describe('timingSafeCompare', () => {
  it('is true for the same secret', () => {
    expect(timingSafeCompare('s3cret-value', 's3cret-value')).toBe(true);
  });

  it('is false for a different secret of the same length', () => {
    expect(timingSafeCompare('s3cret-value', 's3cret-valuX')).toBe(false);
  });

  it('is false for a different length, without throwing', () => {
    expect(timingSafeCompare('short', 'a-much-longer-secret')).toBe(false);
    expect(timingSafeCompare('', 'secret')).toBe(false);
  });

  it('compares bytes, so non-ASCII text works', () => {
    expect(timingSafeCompare('clé-é', 'clé-é')).toBe(true);
    expect(timingSafeCompare('clé-é', 'cle-e')).toBe(false);
  });

  it('still runs a constant-time comparison when the lengths differ', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');
    timingSafeCompare('short', 'a-much-longer-secret');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
