import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
  AccountType,
  RequestUser,
} from '../../common/context/auth-context.types';
import { CustomersOnlyException } from '../exceptions';

/**
 * The global guards let any valid token through an undecorated route, staff
 * included. Client shipment routes key everything off the caller's User id,
 * so a staff token must be turned away here instead of failing deeper down.
 */
@Injectable()
export class CustomerOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    if (request.user?.accountType !== AccountType.CUSTOMER) {
      throw new CustomersOnlyException();
    }
    return true;
  }
}
