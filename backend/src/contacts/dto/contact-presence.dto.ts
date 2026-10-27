import { ApiProperty } from '@nestjs/swagger';

/** GET /contacts/presence: whether each accepted contact is online now. */
export class ContactPresenceDto {
  @ApiProperty({ format: 'uuid' })
  internalUserId!: string;

  @ApiProperty()
  online!: boolean;
}
