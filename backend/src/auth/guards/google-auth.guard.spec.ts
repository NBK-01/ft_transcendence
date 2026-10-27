import { ExecutionContext } from '@nestjs/common';
import { GOOGLE_AUTH_FAILURE, GoogleAuthGuard } from './google-auth.guard';

/**
 * Passport's default handleRequest throws on any failure, which stops
 * canActivate() from ever resolving — AuthController.googleCallback (the
 * only place that knows how to redirect) never runs. This guard overrides
 * handleRequest to swallow the failure onto the request instead, so the
 * controller always runs and can redirect either way.
 */
function contextWithRequest(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('GoogleAuthGuard.handleRequest', () => {
  it('returns the user on success, unchanged', () => {
    const guard = new GoogleAuthGuard();
    const request: Record<string | symbol, unknown> = {};
    const user = { id: 'user-1' };

    const result = guard.handleRequest(
      null,
      user,
      null,
      contextWithRequest(request),
    );

    expect(result).toBe(user);
    expect(request[GOOGLE_AUTH_FAILURE]).toBeUndefined();
  });

  it('on an error, stashes it on the request and returns undefined instead of throwing', () => {
    const guard = new GoogleAuthGuard();
    const request: Record<string | symbol, unknown> = {};
    const err = new Error('provider blew up');

    const result = guard.handleRequest(
      err,
      false,
      null,
      contextWithRequest(request),
    );

    expect(result).toBeUndefined();
    expect(request[GOOGLE_AUTH_FAILURE]).toBe(err);
  });

  it('on a falsy user with no error (denied consent), stashes `info` and returns undefined', () => {
    const guard = new GoogleAuthGuard();
    const request: Record<string | symbol, unknown> = {};
    const info = { message: 'access_denied' };

    const result = guard.handleRequest(
      null,
      false,
      info,
      contextWithRequest(request),
    );

    expect(result).toBeUndefined();
    expect(request[GOOGLE_AUTH_FAILURE]).toBe(info);
  });
});
