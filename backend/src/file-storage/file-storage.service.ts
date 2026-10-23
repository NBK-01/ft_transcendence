import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
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

const SHIPMENT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const SHIPMENT_DOCUMENT_MIME_TYPES = [
  ...SHIPMENT_IMAGE_MIME_TYPES,
  'application/pdf',
];
const SHIPMENT_FILE_MAX_SIZE_MB = 10;

/** 'image': product/offer photos. 'document': images or PDFs (proof of delivery, etc.). */
export type ShipmentFileCategory = 'image' | 'document';

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

  /** Validate before uploading anything, so a batch never half-uploads because of its last file. */
  validateShipmentFile(
    buffer: Buffer,
    contentType: string,
    category: ShipmentFileCategory,
  ): void {
    const allowed =
      category === 'image'
        ? SHIPMENT_IMAGE_MIME_TYPES
        : SHIPMENT_DOCUMENT_MIME_TYPES;
    if (!allowed.includes(contentType)) {
      throw new InvalidFileTypeException(allowed);
    }
    if (buffer.length > SHIPMENT_FILE_MAX_SIZE_MB * 1024 * 1024) {
      throw new FileTooLargeException(SHIPMENT_FILE_MAX_SIZE_MB);
    }
  }

  /** Returns only the key — persist that, and resolve a URL with getFileUrl() on every read. */
  async uploadShipmentFile(
    buffer: Buffer,
    trackingId: string,
    originalFilename: string,
    contentType: string,
    category: ShipmentFileCategory,
  ): Promise<{ key: string }> {
    this.validateShipmentFile(buffer, contentType, category);
    const ext = extname(originalFilename);
    const key = `shipments/${trackingId}/${Date.now()}-${randomUUID()}${ext}`;
    await this.provider.uploadFile(buffer, key, { contentType });
    return { key };
  }

  /** Signed URLs expire — call on every read, never persist the result. */
  async getFileUrl(key: string): Promise<string> {
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
