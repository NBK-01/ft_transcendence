import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BootstrapSecretGuard } from './bootstrap-secret.guard';

function makeContext(headerValue?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers:
          headerValue === undefined
            ? {}
            : { 'x-bootstrap-secret': headerValue },
      }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(secret: string): BootstrapSecretGuard {
  const config = { get: () => secret } as unknown as ConfigService;
  return new BootstrapSecretGuard(config);
}

describe('BootstrapSecretGuard', () => {
  const SECRET = 'super-secret-value';

  it('accepts a matching secret', () => {
    const guard = makeGuard(SECRET);
    expect(guard.canActivate(makeContext(SECRET))).toBe(true);
    expect(guard.isValid(SECRET)).toBe(true);
  });

  it('rejects a wrong secret', () => {
    const guard = makeGuard(SECRET);
    expect(guard.isValid('wrong-secret-value!')).toBe(false);
    expect(() => guard.canActivate(makeContext('nope'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a secret of different length (no timingSafeEqual throw)', () => {
    const guard = makeGuard(SECRET);
    expect(guard.isValid(SECRET + 'x')).toBe(false);
    expect(guard.isValid(SECRET.slice(0, -1))).toBe(false);
  });

  it('rejects a missing / non-string / empty header', () => {
    const guard = makeGuard(SECRET);
    expect(() => guard.canActivate(makeContext())).toThrow(
      UnauthorizedException,
    );
    expect(guard.isValid(undefined)).toBe(false);
    expect(guard.isValid('')).toBe(false);
    expect(guard.isValid(12345)).toBe(false);
  });

  it('is disabled when the configured secret is empty', () => {
    const guard = makeGuard('');
    expect(guard.isValid('')).toBe(false);
    expect(guard.isValid('anything')).toBe(false);
    expect(() => guard.canActivate(makeContext('anything'))).toThrow(
      UnauthorizedException,
    );
  });
});
