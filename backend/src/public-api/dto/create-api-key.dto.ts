import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'Carrier tracking sync',
    maxLength: 100,
    description: 'What the key is for, shown in the list',
  })
  // Trimmed first, so a name of spaces counts as empty.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The branch (organization) the key acts for',
  })
  @IsUUID()
  organizationId!: string;
}
