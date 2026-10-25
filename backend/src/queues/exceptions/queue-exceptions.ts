import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum QueueErrorCodes {
  UnknownJobType = 13001,
}

export enum QueueErrorMessages {
  UnknownJobType = 'errors.UNKNOWN_JOB_TYPE',
}

/** A job whose name has no handler, e.g. left in Redis by an older version of the app. */
export class UnknownJobTypeException extends DomainException {
  constructor(name: string) {
    super(
      { key: QueueErrorMessages.UnknownJobType, params: { name } },
      HttpStatus.INTERNAL_SERVER_ERROR,
      QueueErrorCodes.UnknownJobType,
    );
  }
}
