import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum FileStorageErrorCodes {
  InvalidFileType = 9001,
  FileTooLarge = 9002,
  FileUploadFailed = 9003,
  FileDeleteFailed = 9004,
}

export enum FileStorageErrorMessages {
  InvalidFileType = 'errors.INVALID_FILE_TYPE',
  FileTooLarge = 'errors.FILE_TOO_LARGE',
  FileUploadFailed = 'errors.FILE_UPLOAD_FAILED',
  FileDeleteFailed = 'errors.FILE_DELETE_FAILED',
}

export class InvalidFileTypeException extends DomainException {
  constructor(allowed: string[]) {
    super(
      {
        key: FileStorageErrorMessages.InvalidFileType,
        params: { allowed: allowed.join(', ') },
      },
      HttpStatus.BAD_REQUEST,
      FileStorageErrorCodes.InvalidFileType,
    );
  }
}

export class FileTooLargeException extends DomainException {
  constructor(maxSizeMb: number) {
    super(
      {
        key: FileStorageErrorMessages.FileTooLarge,
        params: { maxSizeMb },
      },
      HttpStatus.BAD_REQUEST,
      FileStorageErrorCodes.FileTooLarge,
    );
  }
}

/** Wraps S3Client errors — the real error is logged server-side (see S3StorageProvider), not exposed to the caller. */
export class FileUploadFailedException extends DomainException {
  constructor() {
    super(
      { key: FileStorageErrorMessages.FileUploadFailed },
      HttpStatus.INTERNAL_SERVER_ERROR,
      FileStorageErrorCodes.FileUploadFailed,
    );
  }
}

/** Wraps S3Client delete errors — the real error is logged server-side (see S3StorageProvider), not exposed to the caller. */
export class FileDeleteFailedException extends DomainException {
  constructor() {
    super(
      { key: FileStorageErrorMessages.FileDeleteFailed },
      HttpStatus.INTERNAL_SERVER_ERROR,
      FileStorageErrorCodes.FileDeleteFailed,
    );
  }
}
