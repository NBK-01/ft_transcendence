import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { STORAGE_PROVIDER_TOKEN } from './constants/storage-provider.token';
import { s3Config } from '../config/s3.config';

@Module({
  providers: [
    FileStorageService,
    {
      provide: STORAGE_PROVIDER_TOKEN,
      useFactory: () => new S3StorageProvider(s3Config()),
    },
  ],
  exports: [FileStorageService],
})
export class FileStorageModule {}
