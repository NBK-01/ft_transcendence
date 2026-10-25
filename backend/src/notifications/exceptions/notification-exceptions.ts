import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum NotificationErrorCodes {
  NotificationNotFound = 12001,
}

export enum NotificationErrorMessages {
  NotificationNotFound = 'errors.NOTIFICATION_NOT_FOUND',
}

/** Also thrown for someone else's notification, or one that was dismissed — never reveal that it exists. */
export class NotificationNotFoundException extends DomainException {
  constructor(id: string) {
    super(
      { key: NotificationErrorMessages.NotificationNotFound, params: { id } },
      HttpStatus.NOT_FOUND,
      NotificationErrorCodes.NotificationNotFound,
    );
  }
}
