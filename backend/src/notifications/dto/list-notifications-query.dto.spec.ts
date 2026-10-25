import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListNotificationsQueryDto } from './list-notifications-query.dto';

/** Same options as main.ts's ValidationPipe, where query values arrive as strings. */
async function parse(query: Record<string, string>) {
  const dto = plainToInstance(ListNotificationsQueryDto, query, {
    enableImplicitConversion: true,
  });
  return { dto, errors: await validate(dto, { whitelist: true }) };
}

describe('ListNotificationsQueryDto', () => {
  it('defaults to page 1, 20 per page, no filters', async () => {
    const { dto, errors } = await parse({});

    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ page: 1, limit: 20 });
    expect(dto.unreadOnly).toBeUndefined();
    expect(dto.type).toBeUndefined();
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('reads unreadOnly=%s as %s', async (raw, expected) => {
    const { dto, errors } = await parse({ unreadOnly: raw });

    expect(errors).toEqual([]);
    expect(dto.unreadOnly).toBe(expected);
  });

  it('rejects an unreadOnly that is not true or false', async () => {
    const { errors } = await parse({ unreadOnly: 'yes' });

    expect(errors.map((error) => error.property)).toEqual(['unreadOnly']);
  });

  it('rejects a limit over 100 and an unknown type', async () => {
    const { errors } = await parse({ limit: '101', type: 'NOPE' });

    expect(errors.map((error) => error.property).sort()).toEqual([
      'limit',
      'type',
    ]);
  });
});
