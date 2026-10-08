import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { MissingAuthContextException } from '../exceptions';
import { RequestUser } from './auth-context.types';

const USER_KEY = 'user';

/**
 * Request-scoped auth context, backed by nestjs-cls (AsyncLocalStorage under
 * the hood). Populated exactly once per request, inside the JWT strategy's
 * validate() — nothing else should call `set()`.
 */
@Injectable()
export class AuthContextService {
  constructor(private readonly cls: ClsService) {}

  set(user: RequestUser): void {
    this.cls.set(USER_KEY, user);
  }

  getUser(): RequestUser | undefined {
    return this.cls.get<RequestUser>(USER_KEY);
  }

  requireUser(): RequestUser {
    const user = this.getUser();
    if (!user) {
      throw new MissingAuthContextException();
    }
    return user;
  }

  getTraceId(): string | undefined {
    return this.cls.getId?.();
  }
}
