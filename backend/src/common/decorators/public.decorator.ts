import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Bypasses JwtAuthGuard for this route/controller. Auth is on by default
 * (JwtAuthGuard is registered globally) — this is the explicit opt-out.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
