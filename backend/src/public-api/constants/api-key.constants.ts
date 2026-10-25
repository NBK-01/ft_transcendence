/** Every key starts with this, so a leaked one is easy to recognise (logs, secret scanners). */
export const API_KEY_PREFIX = 'stk_';

/** How many random bytes follow the prefix: 32, written as 64 hex characters. */
export const API_KEY_RANDOM_BYTES = 32;

/** The only shape a key can have. Anything else is refused before the database is asked. */
export const API_KEY_PATTERN = /^stk_[0-9a-f]{64}$/;

/**
 * How much of the key's start is stored and shown: "stk_" plus 4 characters.
 * With the last 4, that's 32 of the 256 random bits, enough to tell a
 * branch's keys apart in a list and nowhere near enough to guess one.
 */
export const API_KEY_VISIBLE_PREFIX_LENGTH = 8;

/**
 * bcrypt cost. A check runs on every partner request (only for a key the
 * HMAC lookup found), so this stays at bcrypt's default rather than higher.
 */
export const API_KEY_BCRYPT_ROUNDS = 10;

/** API_KEY_HMAC_SECRET must be at least this long. */
export const API_KEY_HMAC_SECRET_MIN_LENGTH = 32;

/** lastUsedAt is written at most this often per key. */
export const LAST_USED_WRITE_INTERVAL_MS = 60_000;

/**
 * Why a key was refused. INVALID is the only answer for a key that isn't
 * real; the others are only given once bcrypt has confirmed the key, so
 * only its holder learns them.
 */
export enum ApiKeyRejection {
  /** Malformed, unknown, or the hash doesn't match. */
  INVALID = 'INVALID',
  REVOKED = 'REVOKED',
  /** The key's branch is deactivated, or gone. */
  BRANCH_INACTIVE = 'BRANCH_INACTIVE',
}
