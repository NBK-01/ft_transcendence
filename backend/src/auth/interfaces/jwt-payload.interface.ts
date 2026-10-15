import { AccountType } from '../../common/context/auth-context.types';

export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

export interface AccessTokenPayload {
  sub: string; // user id
  type: TokenType.ACCESS;
  accountType: AccountType; // which table issued this — customer (User) vs staff (InternalUser)
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  type: TokenType.REFRESH;
  accountType: AccountType;
  jti: string; // RefreshToken row id — identifies which DB record to check
  iat?: number;
  exp?: number;
}

export type JwtPayload = AccessTokenPayload | RefreshTokenPayload;
