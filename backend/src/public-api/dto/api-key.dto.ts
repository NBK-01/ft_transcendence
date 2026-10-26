import { ApiProperty } from '@nestjs/swagger';

export class ApiKeyBranchDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Lyon' })
  name!: string;
}

export class ApiKeyCreatorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Jane Admin' })
  name!: string;
}

/** A key as lists show it: never the key itself, nor anything derived from it but its ends. */
export class ApiKeyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Carrier tracking sync' })
  name!: string;

  @ApiProperty({
    example: 'stk_9f3a…c41e',
    description: "The key's first and last characters",
  })
  maskedKey!: string;

  @ApiProperty({ type: ApiKeyBranchDto })
  organization!: ApiKeyBranchDto;

  @ApiProperty({
    type: ApiKeyCreatorDto,
    nullable: true,
    description: 'The admin who created it. Null if that account was deleted',
  })
  createdBy!: ApiKeyCreatorDto | null;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'Updated at most once a minute',
  })
  lastUsedAt!: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'Set when revoked: the key no longer works',
  })
  revokedAt!: Date | null;
}

export class CreatedApiKeyDto extends ApiKeyDto {
  @ApiProperty({
    example:
      'stk_9f3a5be07d1c42a8e6f0b3d9c2a7e5f18b4d6c0a9e3f7b2d5c8a1e4f6b90c41e',
    description:
      'The full key. Returned this once only: it is not stored and cannot be shown again',
  })
  key!: string;
}
