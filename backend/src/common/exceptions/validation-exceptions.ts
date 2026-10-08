import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base/error-types';

export enum ValidationErrorCodes {
  MissingRequiredData = 5001,
  InvalidFieldValue = 5002,
}

export enum ValidationErrorMessages {
  MissingRequiredData = 'errors.MISSING_REQUIRED_DATA',
  InvalidFieldValue = 'errors.INVALID_FIELD_VALUE',
}

export class MissingRequiredDataException extends DomainException {
  constructor(field: string) {
    super(
      { key: ValidationErrorMessages.MissingRequiredData, params: { field } },
      HttpStatus.BAD_REQUEST,
      ValidationErrorCodes.MissingRequiredData,
    );
  }
}
