import { ApiProperty } from '@nestjs/swagger';
import { ConversationType } from '../entities/conversation.entity';

export class ConversationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ConversationType })
  type!: ConversationType;

  @ApiProperty({ format: 'uuid', nullable: true, required: false })
  customerId?: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, required: false })
  participantAId?: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, required: false })
  participantBId?: string | null;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date })
  updatedAt!: Date;
}
