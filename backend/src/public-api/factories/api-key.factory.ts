import { ApiKey } from '../entities/api-key.entity';
import { Organization } from '../../organizations/organization.entity';
import { InternalUser } from '../../internal-users/internal-user.entity';
import { ApiKeyDto } from '../dto/api-key.dto';

/** A key loaded with its branch and creator, as ApiKeysService always loads it for a response. */
export type ApiKeyWithRelations = ApiKey & {
  organization: Organization;
  createdBy: InternalUser | null;
};

export class ApiKeyFactory {
  static toDto(apiKey: ApiKeyWithRelations): ApiKeyDto {
    return {
      id: apiKey.id,
      name: apiKey.name,
      maskedKey: `${apiKey.prefix}…${apiKey.last4}`,
      organization: {
        id: apiKey.organization.id,
        name: apiKey.organization.name,
      },
      createdBy: apiKey.createdBy
        ? { id: apiKey.createdBy.id, name: apiKey.createdBy.name }
        : null,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
      revokedAt: apiKey.revokedAt,
    };
  }

  static toDtoArray(apiKeys: ApiKeyWithRelations[]): ApiKeyDto[] {
    return apiKeys.map((apiKey) => this.toDto(apiKey));
  }
}
