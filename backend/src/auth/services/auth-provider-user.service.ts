import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthProviderUser } from '../entities/auth-provider-user.entity';
import { AuthProvider } from '../../users/user.entity';

export interface OAuthProfile {
  providerId: string;
  email: string;
  name: string;
  profilePicture?: string | null;
}

@Injectable()
export class AuthProviderUserService {
  constructor(
    @InjectRepository(AuthProviderUser)
    private readonly repository: Repository<AuthProviderUser>,
  ) {}

  async findByProvider(
    provider: AuthProvider,
    providerId: string,
  ): Promise<AuthProviderUser | null> {
    return this.repository.findOne({ where: { provider, providerId } });
  }

  async create(
    userId: string,
    provider: AuthProvider,
    profile: OAuthProfile,
  ): Promise<AuthProviderUser> {
    const link = this.repository.create({
      userId,
      provider,
      providerId: profile.providerId,
      email: profile.email,
      name: profile.name,
      profilePicture: profile.profilePicture ?? null,
    });
    return this.repository.save(link);
  }

  /** Re-syncs cached profile fields on repeat login — email/name/picture can drift on the provider's side. */
  async updateProfile(id: string, profile: OAuthProfile): Promise<void> {
    await this.repository.update(id, {
      email: profile.email,
      name: profile.name,
      profilePicture: profile.profilePicture ?? null,
    });
  }
}
