import { GUARDS_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { ApiKeyGuard } from './guards/api-key.guard';
import { PartnerController } from './partner.controller';
import { PartnerContext } from './types/partner-context';

describe('PartnerController', () => {
  it('skips the login check and asks for an API key instead (@PartnerApi)', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PartnerController)).toBe(true);
    expect(Reflect.getMetadata(GUARDS_METADATA, PartnerController)).toEqual([
      ApiKeyGuard,
    ]);
  });

  it('GET /v1/me says which key and branch are calling', () => {
    const partner: PartnerContext = {
      id: 'key-1',
      name: 'Carrier sync',
      organizationId: 'org-1',
      organizationName: 'Lyon',
      isInternal: false,
    };
    expect(new PartnerController().me(partner)).toEqual({
      keyId: 'key-1',
      name: 'Carrier sync',
      branch: { id: 'org-1', name: 'Lyon' },
      internal: false,
    });
  });
});
