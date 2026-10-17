import { Inject, Injectable } from '@nestjs/common';
import { extname } from 'path';
import { STORAGE_PROVIDER_TOKEN } from './constants/storage-provider.token';
import { StorageProvider } from './interfaces/storage-provider.interface';
import {
  InvalidFileTypeException,
  FileTooLargeException,
} from './exceptions/file-storage-exceptions';

const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_SIZE_MB = 2;
const AVATAR_MAX_SIZE_BYTES = AVATAR_MAX_SIZE_MB * 1024 * 1024;

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly provider: StorageProvider,
  ) {}

  async uploadAvatar(
    buffer: Buffer,
    userId: string,
    originalFilename: string,
    contentType: string,
  ): Promise<{ url: string; key: string }> {
    this.validateAvatar(buffer, contentType);
    const key = this.generateAvatarKey(userId, originalFilename);
    await this.provider.uploadFile(buffer, key, { contentType });
    return { url: await this.provider.getSignedUrl(key), key };
  }

  /** Call whenever serving a stored avatarKey back to a client — signed URLs expire, never persist one. */
  async getAvatarUrl(key: string): Promise<string> {
    return this.provider.getSignedUrl(key);
  }

  async deleteFile(key: string): Promise<void> {
    await this.provider.deleteFile(key);
  }

  private validateAvatar(buffer: Buffer, contentType: string): void {
    if (!AVATAR_ALLOWED_MIME_TYPES.includes(contentType)) {
      throw new InvalidFileTypeException(AVATAR_ALLOWED_MIME_TYPES);
    }
    if (buffer.length > AVATAR_MAX_SIZE_BYTES) {
      throw new FileTooLargeException(AVATAR_MAX_SIZE_MB);
    }
  }

  private generateAvatarKey(userId: string, originalFilename: string): string {
    const ext = extname(originalFilename);
    return `avatars/${userId}-${Date.now()}${ext}`;
  }
}
