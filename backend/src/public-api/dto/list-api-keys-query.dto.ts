import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListApiKeysQueryDto {
  @ApiProperty({
    required: false,
    format: 'uuid',
    description: "Only this branch's keys",
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
