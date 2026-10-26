import { ApiProperty } from '@nestjs/swagger';
import { ApiKeyBranchDto } from './api-key.dto';

/** GET /v1/me: which key a partner is using, and for which branch. */
export class PartnerKeyDto {
  @ApiProperty({ format: 'uuid' })
  keyId!: string;

  @ApiProperty({ example: 'Carrier tracking sync' })
  name!: string;

  @ApiProperty({ type: ApiKeyBranchDto })
  branch!: ApiKeyBranchDto;

  @ApiProperty({
    description:
      'True when a matching X-Internal-Key was sent: no per-key rate limit',
  })
  internal!: boolean;
}
