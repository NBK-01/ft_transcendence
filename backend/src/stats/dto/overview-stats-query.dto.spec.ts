import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OverviewStatsQueryDto } from './overview-stats-query.dto';

/** Same options as main.ts's ValidationPipe, where query values arrive as strings. */
async function failures(query: Record<string, string>) {
  const dto = plainToInstance(OverviewStatsQueryDto, query, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => [
    error.property,
    Object.keys(error.constraints ?? {}),
  ]);
}

const TODAY = {
  from: '2026-10-26T00:00:00+02:00',
  to: '2026-10-27T00:00:00+02:00',
};

describe('OverviewStatsQueryDto', () => {
  it('takes a period with its time zone, and optionally a branch', async () => {
    expect(await failures(TODAY)).toEqual([]);
    expect(
      await failures({
        ...TODAY,
        organizationId: '00000000-0000-4000-b000-000000000001',
      }),
    ).toEqual([]);
  });

  it('needs both dates, as ISO 8601', async () => {
    expect(await failures({})).toEqual([
      ['from', ['isIso8601']],
      ['to', ['isIso8601']],
    ]);
    expect(await failures({ ...TODAY, from: 'yesterday' })).toEqual([
      ['from', ['isIso8601']],
    ]);
  });

  it('refuses an end that is not after the start', async () => {
    for (const to of [TODAY.from, '2026-10-25T00:00:00+02:00']) {
      expect(await failures({ from: TODAY.from, to })).toEqual([
        ['to', ['isRangeEnd']],
      ]);
    }
  });

  it('takes up to 366 days, not one more', async () => {
    const from = '2025-10-01T00:00:00Z';
    expect(await failures({ from, to: '2026-10-02T00:00:00Z' })).toEqual([]);
    expect(await failures({ from, to: '2026-10-03T00:00:00Z' })).toEqual([
      ['to', ['isRangeEnd']],
    ]);
  });

  it('refuses a branch that is not a UUID, and unknown fields', async () => {
    expect(await failures({ ...TODAY, organizationId: 'beirut' })).toEqual([
      ['organizationId', ['isUuid']],
    ]);
    expect(await failures({ ...TODAY, status: 'delivered' })).toEqual([
      ['status', ['whitelistValidation']],
    ]);
  });
});
