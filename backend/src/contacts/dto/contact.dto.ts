import { ApiProperty } from '@nestjs/swagger';
import { ContactStatus } from '../contact.entity';

export class ContactDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  requesterId!: string;

  @ApiProperty()
  requesterName!: string;

  @ApiProperty()
  requesterEmail!: string;

  @ApiProperty({ format: 'uuid' })
  addresseeId!: string;

  @ApiProperty()
  addresseeName!: string;

  @ApiProperty()
  addresseeEmail!: string;

  @ApiProperty({ enum: ContactStatus })
  status!: ContactStatus;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date })
  updatedAt!: Date;
}
