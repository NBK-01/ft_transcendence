import { Request } from 'express';
import { ApiKeyPrincipal } from '../api-keys.service';

/** Who's calling the public API: the key, its branch, and whether it's one of our own services. */
export interface PartnerContext extends ApiKeyPrincipal {
  /** Sent an X-Internal-Key matching INTERNAL_CALLER_KEY: no per-key rate limit. */
  isInternal: boolean;
}

/** Set by ApiKeyGuard on every request it lets through. */
export interface PartnerRequest extends Request {
  partner?: PartnerContext;
}
