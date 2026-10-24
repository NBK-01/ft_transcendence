import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { AuthContextService } from '../common/context';
import { AccountType } from '../common/context/auth-context.types';
import { CryptoService } from '../common/services/crypto.service';
import { CommunicationService } from '../communication/communication.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { OtpConfigService } from '../otp/config/otp-config.service';
import { OtpLog } from '../otp/entities/otp-log.entity';
import { OtpErrorCodes } from '../otp/exceptions';
import { OtpService } from '../otp/otp.service';
import { UserErrorCodes } from '../users/exceptions';
import { AuthProvider, User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthErrorCodes } from './exceptions/auth-exceptions';
import { TokenType } from './interfaces/jwt-payload.interface';
import { AuthProviderUserService } from './services/auth-provider-user.service';
import { OAuthCodeService } from './services/oauth-code.service';
import { PasswordResetService } from './services/password-reset.service';
import { RefreshTokenService } from './services/refresh-token.service';

/**
 * The customer auth flows end to end — what used to be checked by hand with
 * curl. Everything real (AuthService, RefreshTokenService, OtpService,
 * PasswordResetService, UsersService, argon2, JWT signing) except storage:
 * Postgres and Redis are in-memory, and emails are captured instead of sent,
 * so the OTP code and reset token are read out of the email like a user would.
 */

const EMAIL = 'maria@example.com';
const PASSWORD = 'Client1234!';
const NEW_PASSWORD = 'Brand-new-pass-99';
const JWT_SECRET = 'test-only-secret';

/** Postgres-like: `where` matches exactly (so case-sensitive), `id` and timestamps are set on insert. */
class InMemoryTable<T extends { id: string; createdAt: Date }> {
  readonly rows: T[] = [];
  private nextId = 1;

  constructor(
    private readonly name: string,
    private readonly defaults: () => Partial<T> = () => ({}),
  ) {}

  create(values: Partial<T>): T {
    return { ...this.defaults(), ...values } as T;
  }

  save(values: Partial<T>): Promise<T> {
    const existing = this.rows.find((row) => row.id === values.id);
    if (existing) {
      return Promise.resolve(Object.assign(existing, values));
    }
    const row = Object.assign(this.create(values), {
      id: `${this.name}-${this.nextId++}`,
      createdAt: new Date(),
    });
    this.rows.push(row);
    return Promise.resolve(row);
  }

  findOne({ where }: { where: Partial<T> }): Promise<T | null> {
    return Promise.resolve(
      this.rows.find((row) => this.matches(row, where)) ?? null,
    );
  }

  update(id: string, values: Partial<T>): Promise<void> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row) Object.assign(row, values);
    return Promise.resolve();
  }

  delete(where: Partial<T>): Promise<{ affected: number }> {
    const before = this.rows.length;
    const kept = this.rows.filter((row) => !this.matches(row, where));
    this.rows.splice(0, this.rows.length, ...kept);
    return Promise.resolve({ affected: before - kept.length });
  }

  private matches(row: T, where: Partial<T>): boolean {
    return Object.entries(where).every(
      ([key, value]) => row[key as keyof T] === value,
    );
  }
}

/** The handful of Redis commands OTP and password reset use, with TTLs. */
class InMemoryRedis {
  private readonly store = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  setex(key: string, seconds: number, value: string): Promise<'OK'> {
    this.store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return Promise.resolve('OK');
  }

  get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.store.delete(key) ? 1 : 0);
  }

  ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    return Promise.resolve(
      entry ? Math.ceil((entry.expiresAt - Date.now()) / 1000) : -2,
    );
  }
}

class Outbox {
  readonly sent: { to: string; subject: string; html: string }[] = [];

  sendEmail(to: string, subject: string, html: string): Promise<void> {
    this.sent.push({ to, subject, html });
    return Promise.resolve();
  }

  /** The code in the newest verification email to `to`. */
  otpFor(to: string): string {
    return this.lastMatch(to, /class="otp-code">(\d+)</);
  }

  /** The token in the newest password-reset email to `to`. */
  resetTokenFor(to: string): string {
    return this.lastMatch(to, /class="token-box">([a-f0-9]+)</);
  }

  private lastMatch(to: string, pattern: RegExp): string {
    const email = this.sent.filter((mail) => mail.to === to).at(-1);
    const match = email?.html.match(pattern);
    if (!match) throw new Error(`No matching email was sent to ${to}`);
    return match[1];
  }
}

function setup(env: Record<string, string> = {}) {
  const config = {
    get: <T>(key: string, fallback?: T) => (env[key] as T) ?? fallback,
  } as unknown as ConfigService;
  const users = new InMemoryTable<User>('user', () => ({
    isVerified: false,
    authProvider: AuthProvider.EMAIL,
    forceLogoutAfter: null,
  }));
  const sessions = new InMemoryTable<RefreshToken>('session');
  // OTP audit log: written to, never read back by these flows.
  const otpLogs = {
    save: (values: Partial<OtpLog>) => Promise.resolve({ ...values, id: 1 }),
    update: () => Promise.resolve(),
  };
  const redis = new InMemoryRedis() as unknown as Redis;
  const outbox = new Outbox();
  const mail = outbox as unknown as CommunicationService;
  const jwt = new JwtService({ secret: JWT_SECRET });

  const usersService = new UsersService(
    users as unknown as Repository<User>,
    new CryptoService(),
    {} as FileStorageService,
  );
  const refreshTokens = new RefreshTokenService(
    sessions as unknown as Repository<RefreshToken>,
    jwt,
  );
  const auth = new AuthService(
    jwt,
    usersService,
    new OtpService(
      redis,
      new OtpConfigService(config),
      mail,
      otpLogs as unknown as Repository<OtpLog>,
    ),
    new PasswordResetService(redis),
    refreshTokens,
    {} as AuthProviderUserService,
    {} as OAuthCodeService,
    mail,
    config,
    {} as AuthContextService,
  );
  return { auth, jwt, users, sessions, outbox };
}

type Harness = ReturnType<typeof setup>;

/** Register + verify with the emailed code: a ready-to-use account and its first session. */
async function verifiedAccount(harness: Harness, email = EMAIL) {
  await harness.auth.register({ email, password: PASSWORD, name: 'Maria' });
  return harness.auth.verifyOtp({ email, otp: harness.outbox.otpFor(email) });
}

async function expectCode(
  promise: Promise<unknown>,
  code: number,
): Promise<void> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toMatchObject({ code });
}

describe('register → verify → session', () => {
  it('registering emails a 6-digit code and leaves the account unverified', async () => {
    const { auth, users, outbox } = setup();

    const result = await auth.register({
      email: EMAIL,
      password: PASSWORD,
      name: 'Maria',
    });

    expect(result.email).toBe(EMAIL);
    expect(result).not.toHaveProperty('accessToken');
    expect(outbox.otpFor(EMAIL)).toMatch(/^\d{6}$/);
    expect(users.rows).toEqual([
      expect.objectContaining({ email: EMAIL, isVerified: false }),
    ]);
    expect(users.rows[0].password).not.toBe(PASSWORD); // stored hashed
  });

  it('verifying with the emailed code verifies the account and starts a session', async () => {
    const harness = setup();
    const { jwt, users } = harness;

    const session = await verifiedAccount(harness);

    expect(users.rows[0].isVerified).toBe(true);
    expect(session.user).toEqual({
      id: users.rows[0].id,
      email: EMAIL,
      name: 'Maria',
      isVerified: true,
    });
    expect(jwt.verify(session.accessToken)).toMatchObject({
      sub: users.rows[0].id,
      type: TokenType.ACCESS,
      accountType: AccountType.CUSTOMER,
    });
    const rotated = await harness.auth.refresh(session.refreshToken);
    expect(typeof rotated.accessToken).toBe('string');
    expect(typeof rotated.refreshToken).toBe('string');
  });

  it('registering again before verifying reuses the account and sends a new code', async () => {
    const { auth, outbox, users } = setup();
    await auth.register({ email: EMAIL, password: PASSWORD, name: 'Maria' });

    await auth.register({ email: EMAIL, password: PASSWORD, name: 'Maria' });

    expect(users.rows).toHaveLength(1);
    expect(outbox.sent.filter((mail) => mail.to === EMAIL)).toHaveLength(2);
    await expect(
      auth.verifyOtp({ email: EMAIL, otp: outbox.otpFor(EMAIL) }),
    ).resolves.toHaveProperty('accessToken');
  });

  it('registering an email that is already verified is refused', async () => {
    const harness = setup();
    await verifiedAccount(harness);

    await expectCode(
      harness.auth.register({
        email: EMAIL,
        password: PASSWORD,
        name: 'Maria',
      }),
      UserErrorCodes.UserAlreadyExists,
    );
  });

  // KNOWN BUG — remove `.failing` once fixed. UsersService.create saves the
  // email as typed, but findByEmail lowercases before searching (Postgres
  // compares case-sensitively), so this account can never verify or log in.
  it.failing(
    'an email with capital letters can verify and log in',
    async () => {
      const harness = setup();

      await verifiedAccount(harness, 'Maria.Test@Example.com');

      await expect(
        harness.auth.login({
          email: 'Maria.Test@Example.com',
          password: PASSWORD,
        }),
      ).resolves.toHaveProperty('accessToken');
    },
  );
});

describe('verification codes', () => {
  it('a code only works once', async () => {
    const { auth, outbox } = setup();
    await auth.register({ email: EMAIL, password: PASSWORD, name: 'Maria' });
    const otp = outbox.otpFor(EMAIL);
    await auth.verifyOtp({ email: EMAIL, otp });

    await expectCode(
      auth.verifyOtp({ email: EMAIL, otp }),
      OtpErrorCodes.OtpNotFound,
    );
  });

  it('a wrong code is refused; the third wrong try blocks new codes', async () => {
    const { auth, outbox, users } = setup();
    await auth.register({ email: EMAIL, password: PASSWORD, name: 'Maria' });
    const wrong = outbox.otpFor(EMAIL) === '000000' ? '111111' : '000000';

    await expectCode(
      auth.verifyOtp({ email: EMAIL, otp: wrong }),
      OtpErrorCodes.OtpInvalid,
    );
    await expectCode(
      auth.verifyOtp({ email: EMAIL, otp: wrong }),
      OtpErrorCodes.OtpInvalid,
    );
    await expectCode(
      auth.verifyOtp({ email: EMAIL, otp: wrong }),
      OtpErrorCodes.OtpBlocked,
    );

    await expectCode(
      auth.resendOtp({ email: EMAIL }),
      OtpErrorCodes.OtpBlocked,
    );
    expect(users.rows[0].isVerified).toBe(false);
  });

  it.each(['test', 'production'])(
    'the dev shortcut code 123456 does not work when NODE_ENV=%s',
    async (nodeEnv) => {
      const { auth, outbox, users } = setup({ NODE_ENV: nodeEnv });
      await auth.register({ email: EMAIL, password: PASSWORD, name: 'Maria' });
      if (outbox.otpFor(EMAIL) === '123456') return; // the real code, 1 run in a million

      await expectCode(
        auth.verifyOtp({ email: EMAIL, otp: '123456' }),
        OtpErrorCodes.OtpInvalid,
      );
      expect(users.rows[0].isVerified).toBe(false);
    },
  );
});

describe('login', () => {
  it('with the right password: a new session for the account', async () => {
    const harness = setup();
    const { user } = await verifiedAccount(harness);

    const session = await harness.auth.login({
      email: EMAIL,
      password: PASSWORD,
    });

    expect(session.user).toEqual({ id: user.id, email: EMAIL, name: 'Maria' });
    expect(harness.sessions.rows).toHaveLength(2); // one from verifying, one from login
  });

  it('finds the account whatever case the email is typed in', async () => {
    const harness = setup();
    await verifiedAccount(harness);

    await expect(
      harness.auth.login({ email: '  MARIA@Example.COM ', password: PASSWORD }),
    ).resolves.toHaveProperty('accessToken');
  });

  it('a wrong password and an unknown email get the same error (2002)', async () => {
    const harness = setup();
    await verifiedAccount(harness);

    await expectCode(
      harness.auth.login({ email: EMAIL, password: 'not-my-password' }),
      AuthErrorCodes.InvalidCredentials,
    );
    await expectCode(
      harness.auth.login({ email: 'nobody@example.com', password: PASSWORD }),
      AuthErrorCodes.InvalidCredentials,
    );
  });

  it('an unverified account is refused (2005), but only after the password checks out', async () => {
    const { auth } = setup();
    await auth.register({ email: EMAIL, password: PASSWORD, name: 'Maria' });

    await expectCode(
      auth.login({ email: EMAIL, password: PASSWORD }),
      AuthErrorCodes.AccountNotVerified,
    );
    // A wrong password must not reveal that the account exists but is unverified.
    await expectCode(
      auth.login({ email: EMAIL, password: 'not-my-password' }),
      AuthErrorCodes.InvalidCredentials,
    );
  });

  it('a Google account has no password to log in with (2009)', async () => {
    const { auth, users } = setup();
    await users.save({
      email: EMAIL,
      name: 'Maria',
      password: null,
      isVerified: true,
      authProvider: AuthProvider.GOOGLE,
    });

    await expectCode(
      auth.login({ email: EMAIL, password: PASSWORD }),
      AuthErrorCodes.WrongAuthProvider,
    );
  });
});

describe('refresh', () => {
  it('rotates: the new token works, the old one is single-use (2003), same session row', async () => {
    const harness = setup();
    const first = await verifiedAccount(harness);

    const second = await harness.auth.refresh(first.refreshToken);

    await expectCode(
      harness.auth.refresh(first.refreshToken),
      AuthErrorCodes.InvalidRefreshToken,
    );
    await expect(
      harness.auth.refresh(second.refreshToken),
    ).resolves.toHaveProperty('refreshToken');
    expect(harness.sessions.rows).toHaveLength(1);
  });

  it.each([
    ['garbage', () => 'not-a-token'],
    [
      'an access token',
      (session: { accessToken: string }) => session.accessToken,
    ],
    [
      'a refresh token with its secret part changed',
      (session: { refreshToken: string }) =>
        session.refreshToken.replace(/\.[a-f0-9]+$/, `.${'0'.repeat(64)}`),
    ],
    [
      'a refresh token signed with another secret',
      (session: { refreshToken: string }) => {
        const [, payload, , secret] = session.refreshToken.split('.');
        const forged = new JwtService({ secret: 'attacker' }).sign(
          JSON.parse(Buffer.from(payload, 'base64url').toString()) as object,
        );
        return `${forged}.${secret}`;
      },
    ],
  ])('refuses %s (2003)', async (_label, tamper) => {
    const harness = setup();
    const session = await verifiedAccount(harness);

    await expectCode(
      harness.auth.refresh(tamper(session)),
      AuthErrorCodes.InvalidRefreshToken,
    );
  });

  it('refuses an expired session (2006)', async () => {
    const harness = setup();
    const session = await verifiedAccount(harness);
    harness.sessions.rows[0].expiresAt = new Date(Date.now() - 1000);

    await expectCode(
      harness.auth.refresh(session.refreshToken),
      AuthErrorCodes.RefreshTokenExpired,
    );
  });

  it('refuses a session started before a forced logout (2007)', async () => {
    const harness = setup();
    const session = await verifiedAccount(harness);
    harness.users.rows[0].forceLogoutAfter = new Date(Date.now() + 1000);

    await expectCode(
      harness.auth.refresh(session.refreshToken),
      AuthErrorCodes.SessionInvalidated,
    );
  });

  it('logout ends only that session; logging out a bad token does not error', async () => {
    const harness = setup();
    const phone = await verifiedAccount(harness);
    const laptop = await harness.auth.login({
      email: EMAIL,
      password: PASSWORD,
    });

    await harness.auth.logout(phone.refreshToken);
    await expect(harness.auth.logout('not-a-token')).resolves.toEqual({
      message: 'Logged out',
    });

    await expectCode(
      harness.auth.refresh(phone.refreshToken),
      AuthErrorCodes.InvalidRefreshToken,
    );
    await expect(
      harness.auth.refresh(laptop.refreshToken),
    ).resolves.toBeDefined();
  });

  it('logout everywhere ends every session', async () => {
    const harness = setup();
    const phone = await verifiedAccount(harness);
    const laptop = await harness.auth.login({
      email: EMAIL,
      password: PASSWORD,
    });

    await harness.auth.logoutAll(phone.user.id);

    for (const session of [phone, laptop]) {
      await expectCode(
        harness.auth.refresh(session.refreshToken),
        AuthErrorCodes.InvalidRefreshToken,
      );
    }
  });
});

describe('password reset', () => {
  it('the emailed token sets a new password and signs out every session', async () => {
    const harness = setup();
    const session = await verifiedAccount(harness);
    await harness.auth.forgotPassword({ email: EMAIL });

    await harness.auth.resetPassword({
      token: harness.outbox.resetTokenFor(EMAIL),
      newPassword: NEW_PASSWORD,
    });

    await expect(
      harness.auth.login({ email: EMAIL, password: NEW_PASSWORD }),
    ).resolves.toHaveProperty('accessToken');
    await expectCode(
      harness.auth.login({ email: EMAIL, password: PASSWORD }),
      AuthErrorCodes.InvalidCredentials,
    );
    await expectCode(
      harness.auth.refresh(session.refreshToken),
      AuthErrorCodes.InvalidRefreshToken,
    );
  });

  it('a reset token only works once (2004)', async () => {
    const harness = setup();
    await verifiedAccount(harness);
    await harness.auth.forgotPassword({ email: EMAIL });
    const token = harness.outbox.resetTokenFor(EMAIL);
    await harness.auth.resetPassword({ token, newPassword: NEW_PASSWORD });

    await expectCode(
      harness.auth.resetPassword({ token, newPassword: 'Another-pass-123' }),
      AuthErrorCodes.InvalidResetToken,
    );
    await expect(
      harness.auth.login({ email: EMAIL, password: NEW_PASSWORD }),
    ).resolves.toHaveProperty('accessToken');
  });

  it('a made-up token is refused (2004)', async () => {
    const { auth } = setup();

    await expectCode(
      auth.resetPassword({ token: 'a'.repeat(64), newPassword: NEW_PASSWORD }),
      AuthErrorCodes.InvalidResetToken,
    );
  });

  it('an unknown email gets the same answer, and no email is sent', async () => {
    const harness = setup();
    await verifiedAccount(harness);
    const known = await harness.auth.forgotPassword({ email: EMAIL });
    const sentBefore = harness.outbox.sent.length;

    const unknown = await harness.auth.forgotPassword({
      email: 'nobody@example.com',
    });

    expect(unknown).toEqual(known);
    expect(harness.outbox.sent).toHaveLength(sentBefore);
  });

  it('a Google account cannot set a password this way (2009)', async () => {
    const { auth, users, outbox } = setup();
    await users.save({
      email: EMAIL,
      name: 'Maria',
      password: null,
      isVerified: true,
      authProvider: AuthProvider.GOOGLE,
    });
    await auth.forgotPassword({ email: EMAIL });

    await expectCode(
      auth.resetPassword({
        token: outbox.resetTokenFor(EMAIL),
        newPassword: NEW_PASSWORD,
      }),
      AuthErrorCodes.WrongAuthProvider,
    );
  });
});
