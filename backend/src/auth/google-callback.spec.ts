import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthContextService } from '../common/context';
import { UsersService } from '../users/users.service';
import {
  GOOGLE_AUTH_FAILURE,
  RequestWithGoogleFailure,
} from './guards/google-auth.guard';
import {
  AuthErrorCodes,
  GoogleEmailNotVerifiedException,
} from './exceptions/auth-exceptions';

/**
 * AuthController.googleCallback is the single place that turns a Google
 * OAuth attempt into a redirect back to the frontend — on success (a
 * one-time code), on a service-level failure (handleGoogleCallback throws),
 * and now on a guard-level failure (GoogleAuthGuard couldn't authenticate at
 * all: denied consent, an unverified email, a provider error). Before this,
 * a guard failure never reached this method — Passport threw first and the
 * caller got a raw JSON error instead of a redirect.
 */

const FRONTEND_URL = 'https://localhost';

function setup() {
  const authService = {
    handleGoogleCallback: jest.fn(),
  };
  const configService = {
    get: () => FRONTEND_URL,
  };
  const controller = new AuthController(
    authService as unknown as AuthService,
    {} as AuthContextService,
    {} as UsersService,
    configService as unknown as ConfigService,
  );

  const redirects: string[] = [];
  const res = { redirect: (url: string) => redirects.push(url) };

  const request = (overrides: Partial<RequestWithGoogleFailure> = {}) =>
    ({
      user: { email: 'jane@example.com' },
      ...overrides,
    }) as RequestWithGoogleFailure;

  return { controller, authService, res, redirects, request };
}

describe('AuthController.googleCallback', () => {
  it('redirects with a one-time code on success', async () => {
    const { controller, authService, res, redirects, request } = setup();
    authService.handleGoogleCallback.mockResolvedValue('one-time-code-123');

    await controller.googleCallback(request(), res as never);

    expect(redirects).toEqual([
      `${FRONTEND_URL}/auth/oauth-callback?code=one-time-code-123`,
    ]);
  });

  it('redirects with the domain error code when handleGoogleCallback throws a DomainException', async () => {
    const { controller, authService, res, redirects, request } = setup();
    authService.handleGoogleCallback.mockRejectedValue(
      new GoogleEmailNotVerifiedException(),
    );

    await controller.googleCallback(request(), res as never);

    expect(redirects).toEqual([
      `${FRONTEND_URL}/auth/oauth-callback?error=${AuthErrorCodes.GoogleEmailNotVerified}`,
    ]);
  });

  it('redirects with the generic GoogleAuthFailed code when handleGoogleCallback throws something else', async () => {
    const { controller, authService, res, redirects, request } = setup();
    authService.handleGoogleCallback.mockRejectedValue(new Error('boom'));

    await controller.googleCallback(request(), res as never);

    expect(redirects).toEqual([
      `${FRONTEND_URL}/auth/oauth-callback?error=${AuthErrorCodes.GoogleAuthFailed}`,
    ]);
  });

  it('redirects with the domain error code when the GUARD failed (never calls the service)', async () => {
    const { controller, authService, res, redirects, request } = setup();

    await controller.googleCallback(
      request({ [GOOGLE_AUTH_FAILURE]: new GoogleEmailNotVerifiedException() }),
      res as never,
    );

    expect(redirects).toEqual([
      `${FRONTEND_URL}/auth/oauth-callback?error=${AuthErrorCodes.GoogleEmailNotVerified}`,
    ]);
    expect(authService.handleGoogleCallback).not.toHaveBeenCalled();
  });

  it('a denied-consent guard failure (no error object, just falsy user) redirects with GoogleAuthFailed', async () => {
    const { controller, authService, res, redirects, request } = setup();

    // What GoogleAuthGuard.handleRequest stores for passport's `fail` path: an info object, not an Error.
    await controller.googleCallback(
      request({ [GOOGLE_AUTH_FAILURE]: { message: 'access_denied' } }),
      res as never,
    );

    expect(redirects).toEqual([
      `${FRONTEND_URL}/auth/oauth-callback?error=${AuthErrorCodes.GoogleAuthFailed}`,
    ]);
    expect(authService.handleGoogleCallback).not.toHaveBeenCalled();
  });
});
