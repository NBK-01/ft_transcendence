export interface UploadOptions {
  contentType: string;
}

export interface UploadResult {
  key: string;
  bucket: string;
}

/**
 * Swap S3/MinIO/a future provider without touching call sites — everything
 * outside this module talks to FileStorageService, which talks to whatever
 * implements this interface via STORAGE_PROVIDER_TOKEN.
 *
 * No getPublicUrl/public-ACL support — proved against a real Railway/Tigris
 * bucket that per-object ACLs aren't honored there (object lands private
 * regardless of the ACL sent on upload). Every file is read back via a
 * time-limited signed GET URL instead, which works regardless of whether
 * the backend supports public buckets at all.
 */
export interface StorageProvider {
  uploadFile(
    buffer: Buffer,
    key: string,
    options: UploadOptions,
  ): Promise<UploadResult>;
  deleteFile(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  fileExists(key: string): Promise<boolean>;
}
