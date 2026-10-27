import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AccessControlErrorCodes } from '../access-control/exceptions/access-control-exceptions';
import { AuthContextService } from '../common/context';
import { DomainException } from '../common/exceptions/base/error-types';
import { InternalUser } from '../internal-users/internal-user.entity';
import { InternalUsersService } from '../internal-users/internal-users.service';
import { InternalRefreshTokenService } from './services/internal-refresh-token.service';
import { StaffAuthService } from './staff-auth.service';

const jwt = new JwtService({ secret: 'test-secret' });

/** A refresh token as the service sees it: a JWT for the staff member, then its secret part. */
const tokenFor = (staffId: string) =>
  `${jwt.sign({ sub: staffId })}.${'a'.repeat(64)}`;

function setup(staff: Partial<InternalUser>) {
  const account = { id: 'staff-1', isActive: true, ...staff } as InternalUser;
  const internalUsersService = {
    findById: jest.fn().mockResolvedValue(account),
  };
  const tokenRecord = { id: 'session-1' };
  const internalRefreshTokenService = {
    validateRefreshToken: jest.fn().mockResolvedValue(tokenRecord),
    rotateRefreshToken: jest
      .fn()
      .mockResolvedValue({ accessToken: 'new', refreshToken: 'new' }),
  };
  const service = new StaffAuthService(
    jwt,
    internalUsersService as unknown as InternalUsersService,
    internalRefreshTokenService as unknown as InternalRefreshTokenService,
    {} as AuthContextService,
    { emit: jest.fn() } as unknown as EventEmitter2,
  );
  return { service, internalRefreshTokenService, tokenRecord };
}

describe('StaffAuthService.refresh', () => {
  it('rotates a valid session of an active account', async () => {
    const { service, internalRefreshTokenService, tokenRecord } = setup({});

    await expect(service.refresh(tokenFor('staff-1'))).resolves.toEqual({
      accessToken: 'new',
      refreshToken: 'new',
    });
    expect(internalRefreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
      tokenRecord,
      expect.objectContaining({ id: 'staff-1' }),
      undefined,
    );
  });

  it('refuses a deactivated account (401, 7003), after checking the token, and rotates nothing', async () => {
    const { service, internalRefreshTokenService } = setup({
      isActive: false,
    });

    const error = await service
      .refresh(tokenFor('staff-1'))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DomainException);
    expect((error as DomainException).getStatus()).toBe(401);
    expect((error as DomainException).code).toBe(
      AccessControlErrorCodes.InternalUserInactive,
    );
    expect(internalRefreshTokenService.validateRefreshToken).toHaveBeenCalled();
    expect(
      internalRefreshTokenService.rotateRefreshToken,
    ).not.toHaveBeenCalled();
  });
});
