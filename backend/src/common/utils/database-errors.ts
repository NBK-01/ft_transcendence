const POSTGRES_UNIQUE_VIOLATION = '23505';

/**
 * True when `error` is a Postgres unique-constraint violation (SQLSTATE 23505).
 * Shared by every "insert, and recover if a concurrent request already won the
 * race" path (ChatService's findOrInsert* methods, ContactsService.sendRequest)
 * plus BenignQueryErrorLogger, which needs the identical check to know which
 * failed queries are an expected race rather than a real error.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === POSTGRES_UNIQUE_VIOLATION;
}
