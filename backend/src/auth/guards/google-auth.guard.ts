import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/** Set on the request when Google auth fails, read back by AuthController.googleCallback. */
export const GOOGLE_AUTH_FAILURE = Symbol('googleAuthFailure');

export interface RequestWithGoogleFailure extends Request {
  [GOOGLE_AUTH_FAILURE]?: unknown;
}

/**
 * Passport's default handleRequest throws on any failure (denied consent,
 * an unverified email, a provider error) — canActivate() never finishes, so
 * googleCallback() never runs and the caller gets Nest's raw JSON error
 * instead of a redirect back to the frontend.
 *
 * Swallow it here instead: stash whatever Passport gave us on the request
 * and let the guard "succeed" with no user. googleCallback already knows how
 * to turn a missing profile into a redirect — same single place that builds
 * every other oauth-callback redirect, success or failure.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
  ): TUser | undefined {
    if (err || !user) {
      const request = context
        .switchToHttp()
        .getRequest<RequestWithGoogleFailure>();
      request[GOOGLE_AUTH_FAILURE] = err ?? info;
      return undefined;
    }
    return user;
  }
}
