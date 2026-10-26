import { HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { Repository } from 'typeorm';
import { DomainException } from '../common/exceptions/base/error-types';
import { CryptoService } from '../common/services/crypto.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserErrorCodes, UserNotFoundException } from './exceptions';
import { AuthProvider, User } from './user.entity';
import { UsersService } from './users.service';

/**
 * Profile self-service: updateProfile (PATCH /users/profile) and deactivate
 * (DELETE /auth/account, called from AuthService.deactivateAccount — see
 * auth.service.spec.ts for the login/session side of that flow).
 *
 * Runs the real UsersService over an in-memory `user` table.
 */

/** Postgres-like: `where` matches exactly; `update` patches the row by id. */
class InMemoryUsers {
  readonly rows: User[] = [];
  private nextId = 1;

  seed(overrides: Partial<User> = {}): User {
    const user = Object.assign(new User(), {
      id: `user-${this.nextId++}`,
      email: 'maria@example.com',
      password: 'hashed',
      name: 'Maria Test',
      isVerified: true,
      isActive: true,
      authProvider: AuthProvider.EMAIL,
      avatarKey: null,
      forceLogoutAfter: null,
      firstName: 'Maria',
      lastName: 'Test',
      dateOfBirth: null,
      phoneNumber: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    this.rows.push(user);
    return user;
  }

  findOne({ where }: { where: Partial<User> }): Promise<User | null> {
    return Promise.resolve(
      this.rows.find((row) =>
        Object.entries(where).every(
          ([key, value]) => row[key as keyof User] === value,
        ),
      ) ?? null,
    );
  }

  update(id: string, values: Partial<User>): Promise<void> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row) Object.assign(row, values);
    return Promise.resolve();
  }
}

function setup() {
  const users = new InMemoryUsers();
  const service = new UsersService(
    users as unknown as Repository<User>,
    {} as CryptoService,
    {} as FileStorageService,
    new EventEmitter2(),
  );
  return { users, service };
}

const profileDto = (
  overrides: Partial<UpdateProfileDto> = {},
): UpdateProfileDto => ({
  firstName: 'Amina',
  lastName: 'El Idrissi',
  ...overrides,
});

async function expectError(
  promise: Promise<unknown>,
  type: new (...args: never[]) => DomainException,
  status: HttpStatus,
  code: UserErrorCodes,
): Promise<void> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(type);
  expect((error as DomainException).getStatus()).toBe(status);
  expect((error as DomainException).code).toBe(code);
}

describe('updateProfile', () => {
  it('recomputes name as "${firstName} ${lastName}"', async () => {
    const { users, service } = setup();
    const user = users.seed({
      firstName: 'Old',
      lastName: 'Name',
      name: 'Old Name',
    });

    const dto = await service.updateProfile(
      user.id,
      profileDto({ firstName: 'Amina', lastName: 'El Idrissi' }),
    );

    expect(dto).toMatchObject({
      firstName: 'Amina',
      lastName: 'El Idrissi',
      name: 'Amina El Idrissi',
    });
    expect(user.name).toBe('Amina El Idrissi');
  });

  it('sets dateOfBirth and phoneNumber when provided', async () => {
    const { users, service } = setup();
    const user = users.seed();

    const dto = await service.updateProfile(
      user.id,
      profileDto({ dateOfBirth: '1998-04-12', phoneNumber: '+961701234567' }),
    );

    expect(dto.dateOfBirth).toBe('1998-04-12');
    expect(dto.phoneNumber).toBe('+961701234567');
    expect(user.dateOfBirth).toBe('1998-04-12');
    expect(user.phoneNumber).toBe('+961701234567');
  });

  it('leaves dateOfBirth and phoneNumber untouched when omitted from the update', async () => {
    const { users, service } = setup();
    const user = users.seed({
      dateOfBirth: '1998-04-12',
      phoneNumber: '+961701234567',
    });

    const dto = await service.updateProfile(user.id, profileDto());

    expect(dto.dateOfBirth).toBe('1998-04-12');
    expect(dto.phoneNumber).toBe('+961701234567');
  });

  it('clears dateOfBirth and phoneNumber when explicitly set to null', async () => {
    const { users, service } = setup();
    const user = users.seed({
      dateOfBirth: '1998-04-12',
      phoneNumber: '+961701234567',
    });

    const dto = await service.updateProfile(
      user.id,
      profileDto({ dateOfBirth: null, phoneNumber: null }),
    );

    expect(dto.dateOfBirth).toBeNull();
    expect(dto.phoneNumber).toBeNull();
    expect(user.dateOfBirth).toBeNull();
    expect(user.phoneNumber).toBeNull();
  });

  it('an unknown user is 404 (1001)', async () => {
    const { service } = setup();

    await expectError(
      service.updateProfile('nope', profileDto()),
      UserNotFoundException,
      HttpStatus.NOT_FOUND,
      UserErrorCodes.UserNotFound,
    );
  });
});

describe('deactivate', () => {
  it('sets isActive false and stamps forceLogoutAfter', async () => {
    const { users, service } = setup();
    const user = users.seed();

    await service.deactivate(user.id);

    expect(user.isActive).toBe(false);
    expect(user.forceLogoutAfter).toBeInstanceOf(Date);
  });
});

/** Runs class-validator the way the global ValidationPipe would (with its transforms, e.g. trimming). */
async function errorsFor(plain: object): Promise<ValidationError[]> {
  return validate(plainToInstance(UpdateProfileDto, plain));
}
const hasErrorOn = (errors: ValidationError[], property: string) =>
  errors.some((error) => error.property === property);

describe('UpdateProfileDto validation', () => {
  const valid = () => ({ firstName: 'Amina', lastName: 'El Idrissi' });

  it('accepts a minimal valid update with no date of birth or phone', async () => {
    expect(await errorsFor(valid())).toHaveLength(0);
  });

  it.each(['firstName', 'lastName'])('rejects a blank %s', async (field) => {
    const errors = await errorsFor({ ...valid(), [field]: '' });
    expect(hasErrorOn(errors, field)).toBe(true);
  });

  it.each(['firstName', 'lastName'])('rejects a missing %s', async (field) => {
    const errors = await errorsFor({ ...valid(), [field]: undefined });
    expect(hasErrorOn(errors, field)).toBe(true);
  });

  it.each(['firstName', 'lastName'])(
    'rejects a %s over 50 characters',
    async (field) => {
      const errors = await errorsFor({ ...valid(), [field]: 'x'.repeat(51) });
      expect(hasErrorOn(errors, field)).toBe(true);
    },
  );

  it('accepts a valid dateOfBirth', async () => {
    const errors = await errorsFor({ ...valid(), dateOfBirth: '1998-04-12' });
    expect(hasErrorOn(errors, 'dateOfBirth')).toBe(false);
  });

  it('accepts a null dateOfBirth (clearing it)', async () => {
    const errors = await errorsFor({ ...valid(), dateOfBirth: null });
    expect(hasErrorOn(errors, 'dateOfBirth')).toBe(false);
  });

  it.each([
    ['a future date', '2099-01-01'],
    ['before 1900', '1899-12-31'],
    ['malformed (not YYYY-MM-DD)', '12/04/1998'],
    ['not a real calendar date', '2024-02-30'],
    ['garbage', 'not-a-date'],
  ])('rejects a dateOfBirth that is %s', async (_label, dateOfBirth) => {
    const errors = await errorsFor({ ...valid(), dateOfBirth });
    expect(hasErrorOn(errors, 'dateOfBirth')).toBe(true);
  });

  it('accepts a valid international phone number', async () => {
    const errors = await errorsFor({
      ...valid(),
      phoneNumber: '+961 70 123 456',
    });
    expect(hasErrorOn(errors, 'phoneNumber')).toBe(false);
  });

  it('accepts a null phoneNumber (clearing it)', async () => {
    const errors = await errorsFor({ ...valid(), phoneNumber: null });
    expect(hasErrorOn(errors, 'phoneNumber')).toBe(false);
  });

  it.each([
    ['missing the leading +', '961701234'],
    ['fewer than 7 digits', '+123456'],
    ['more than 15 digits', `+${'1'.repeat(16)}`],
    ['containing letters', '+9617abc1234'],
  ])('rejects a phoneNumber %s', async (_label, phoneNumber) => {
    const errors = await errorsFor({ ...valid(), phoneNumber });
    expect(hasErrorOn(errors, 'phoneNumber')).toBe(true);
  });
});
