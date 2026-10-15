import { Organization } from '../organization.entity';
import { OrganizationDto } from '../dto/organization.dto';

export class OrganizationFactory {
  static toDto(org: Organization): OrganizationDto {
    return {
      id: org.id,
      name: org.name,
      description: org.description ?? null,
      contactEmail: org.contactEmail ?? null,
      isActive: org.isActive,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  static toDtoArray(orgs: Organization[]): OrganizationDto[] {
    return orgs.map((org) => this.toDto(org));
  }
}
