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

/** INTERNAL_CALLER_KEY, when set, must be at least this long. */
export const INTERNAL_CALLER_KEY_MIN_LENGTH = 32;

/** lastUsedAt is written at most this often per key. */
export const LAST_USED_WRITE_INTERVAL_MS = 60_000;

/** Where a partner sends its key. Not Authorization: that header carries login tokens. */
export const API_KEY_HEADER = 'x-api-key';

/**
 * Optional, on top of a valid key: one of our own services calling, if it
 * matches INTERNAL_CALLER_KEY (see ApiKeyGuard).
 */
export const INTERNAL_KEY_HEADER = 'x-internal-key';

/** Swagger's name for the API key scheme (config/swagger.config.ts). */
export const API_KEY_SECURITY = 'api-key';

/** Requests per key per window, unless PUBLIC_API_RATE_LIMIT says otherwise. */
export const DEFAULT_RATE_LIMIT = 60;

/** The rate limit's fixed window. */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Where ApiKeyGuard puts the calling partner in the CLS store, for code below the controller. */
export const PARTNER_CONTEXT_KEY = 'partner';

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
