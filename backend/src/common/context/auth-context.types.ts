/** Which table issued the JWT — customers (`User`) vs. staff (`InternalUser`). */
export enum AccountType {
  CUSTOMER = 'customer',
  STAFF = 'staff',
}

/**
 * Minimal shape written into the CLS store by the JWT strategy's `validate()`.
 * Kept here (not in auth/) so common/ doesn't depend on a business module.
 */
export interface RequestUser {
  id: string;
  email: string;
  accountType: AccountType;
}
