import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  ApiKeyRateLimiterService,
  RateLimitState,
} from './api-key-rate-limiter.service';
import {
  DEFAULT_RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
} from '../constants/api-key.constants';

/** What COUNT_SCRIPT does, in memory: a counter per key that resets after the window. */
function fakeRedis(now: () => number) {
  const counters = new Map<string, { count: number; expiresAt: number }>();
  const evalFn = jest.fn(
    (_script: string, _keys: number, key: string, windowMs: number) => {
      let counter = counters.get(key);
      if (!counter || counter.expiresAt <= now()) {
        counter = { count: 0, expiresAt: now() + windowMs };
        counters.set(key, counter);
      }
      counter.count += 1;
      return Promise.resolve([counter.count, counter.expiresAt - now()]);
    },
  );
  return { redis: { eval: evalFn } as unknown as Redis, evalFn };
}

const configWith = (limit?: string) =>
  ({
    get: (key: string) => (key === 'PUBLIC_API_RATE_LIMIT' ? limit : undefined),
  }) as unknown as ConfigService;

describe('ApiKeyRateLimiterService', () => {
  let clock: number;
  const now = () => clock;

  beforeEach(() => {
    clock = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(now);
  });
  afterEach(() => jest.restoreAllMocks());

  it('defaults to 60 a minute, and reads PUBLIC_API_RATE_LIMIT', () => {
    const { redis } = fakeRedis(now);
    expect(new ApiKeyRateLimiterService(redis, configWith()).limit).toBe(
      DEFAULT_RATE_LIMIT,
    );
    expect(new ApiKeyRateLimiterService(redis, configWith('')).limit).toBe(
      DEFAULT_RATE_LIMIT,
    );
    expect(new ApiKeyRateLimiterService(redis, configWith('5')).limit).toBe(5);
  });

  it.each(['0', '-3', '2.5', 'many'])(
    'refuses to start with PUBLIC_API_RATE_LIMIT=%p',
    (limit) => {
      const { redis } = fakeRedis(now);
      expect(
        () => new ApiKeyRateLimiterService(redis, configWith(limit)),
      ).toThrow(/PUBLIC_API_RATE_LIMIT/);
    },
  );

  it('counts down the remaining requests, then says when the limit is passed', async () => {
    const { redis } = fakeRedis(now);
    const limiter = new ApiKeyRateLimiterService(redis, configWith('3'));

    const states: RateLimitState[] = [];
    for (let i = 0; i < 4; i++) {
      states.push(await limiter.hit('key-1'));
    }
    expect(states.map((state) => state.remaining)).toEqual([2, 1, 0, 0]);
    expect(states.map((state) => state.exceeded)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(states[0]).toMatchObject({
      limit: 3,
      resetAt: clock + RATE_LIMIT_WINDOW_MS,
    });
  });

  it('starts again once the window is over', async () => {
    const { redis } = fakeRedis(now);
    const limiter = new ApiKeyRateLimiterService(redis, configWith('1'));
    await limiter.hit('key-1');
    expect((await limiter.hit('key-1')).exceeded).toBe(true);

    clock += RATE_LIMIT_WINDOW_MS;
    expect((await limiter.hit('key-1')).exceeded).toBe(false);
  });

  it('counts each key on its own', async () => {
    const { redis, evalFn } = fakeRedis(now);
    const limiter = new ApiKeyRateLimiterService(redis, configWith('1'));
    await limiter.hit('key-1');
    expect((await limiter.hit('key-2')).exceeded).toBe(false);
    expect(evalFn.mock.calls.map((call) => call[2])).toEqual([
      'public_api:rate_limit:key-1',
      'public_api:rate_limit:key-2',
    ]);
  });
});
