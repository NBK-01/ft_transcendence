const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Minimal duration parser for config strings like '15m' / '30d' / '7d' —
 * covers what jwtConfig() actually produces, without pulling in the `ms`
 * package (its types need `esModuleInterop`, which this project doesn't set).
 */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d|w)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration string: "${value}"`);
  }
  const [, amount, unit] = match;
  return parseInt(amount, 10) * UNIT_MS[unit];
}
