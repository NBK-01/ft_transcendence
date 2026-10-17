import { Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import { S3Config } from '../../config/s3.config';
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from '../interfaces/storage-provider.interface';
import { FileUploadFailedException } from '../exceptions/file-storage-exceptions';

/**
 * AWS SDK v3, constructed with an explicit endpoint/forcePathStyle — this is
 * what lets it talk to MinIO (or any S3-compatible service) with zero code
 * difference from talking to real AWS, only env vars change.
 */
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: S3Config) {
    this.bucket = config.bucket as string;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId as string,
        secretAccessKey: config.secretAccessKey as string,
      },
    });
  }

  async uploadFile(
    buffer: Buffer,
    key: string,
    options: UploadOptions,
  ): Promise<UploadResult> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: options.contentType,
        }),
      );
      return { key, bucket: this.bucket };
    } catch (error) {
      this.logger.error(this.messageOf(error));
      throw new FileUploadFailedException();
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      this.logger.error(this.messageOf(error));
      throw new FileUploadFailedException();
    }
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      return await presign(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn },
      );
    } catch (error) {
      this.logger.error(this.messageOf(error));
      throw new FileUploadFailedException();
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (error instanceof S3ServiceException && error.name === 'NotFound') {
        return false;
      }
      this.logger.error(this.messageOf(error));
      throw new FileUploadFailedException();
    }
  }

  private messageOf(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown storage error';
  }
}
