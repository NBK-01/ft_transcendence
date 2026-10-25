import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PartnerContext, PartnerRequest } from '../types/partner-context';

/** The calling partner, on a route behind @PartnerApi(). */
export const CurrentPartner = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PartnerContext => {
    const partner = ctx.switchToHttp().getRequest<PartnerRequest>().partner;
    if (!partner) {
      // A programming error: the route forgot @PartnerApi().
      throw new Error('@CurrentPartner() needs a route behind @PartnerApi()');
    }
    return partner;
  },
);
