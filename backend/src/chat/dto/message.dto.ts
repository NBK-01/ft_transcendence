import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '../../common/context/auth-context.types';

export class MessageDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  conversationId!: string;

  @ApiProperty({ format: 'uuid' })
  senderId!: string;

  @ApiProperty({ enum: AccountType })
  senderType!: AccountType;

  @ApiProperty()
  content!: string;

  @ApiProperty({ type: Date })
  createdAt!: Date;
}
