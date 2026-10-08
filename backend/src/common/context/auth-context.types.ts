/**
 * Minimal shape written into the CLS store by the JWT strategy's `validate()`.
 * Extend this once the Users module exists — keep it here so common/ doesn't
 * depend on a business module.
 */
export interface RequestUser {
  id: string;
  email: string;
  roles?: string[];
}
