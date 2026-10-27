import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';
import { ShipmentState } from '../constants/shipment-state';

export enum ShipmentErrorCodes {
  ShipmentNotFound = 3001,
  InvalidShipmentState = 3002,
  LinkOrPhotosRequired = 3003,
  TooManyImages = 3004,
  CardExpired = 3005,
  ShipmentFileNotFound = 3006,
  ShipmentFileNotDeletable = 3007,
}

export enum ShipmentErrorMessages {
  ShipmentNotFound = 'errors.SHIPMENT_NOT_FOUND',
  InvalidShipmentState = 'errors.SHIPMENT_INVALID_STATE',
  LinkOrPhotosRequired = 'errors.SHIPMENT_LINK_OR_PHOTOS',
  TooManyImages = 'errors.SHIPMENT_TOO_MANY_IMAGES',
  CardExpired = 'errors.CARD_EXPIRED',
  ShipmentFileNotFound = 'errors.SHIPMENT_FILE_NOT_FOUND',
  ShipmentFileNotDeletable = 'errors.SHIPMENT_FILE_NOT_DELETABLE',
}

/** Also thrown when the shipment exists but belongs to another client — never reveal that it exists. */
export class ShipmentNotFoundException extends DomainException {
  constructor(trackingId: string) {
    super(
      { key: ShipmentErrorMessages.ShipmentNotFound, params: { trackingId } },
      HttpStatus.NOT_FOUND,
      ShipmentErrorCodes.ShipmentNotFound,
    );
  }
}

/** The action isn't allowed from the shipment's current status (or it changed under us). */
export class InvalidShipmentStateException extends DomainException {
  constructor(status: ShipmentState) {
    super(
      { key: ShipmentErrorMessages.InvalidShipmentState, params: { status } },
      HttpStatus.CONFLICT,
      ShipmentErrorCodes.InvalidShipmentState,
    );
  }
}

/** A request needs exactly one of: a product link, or photos. */
export class LinkOrPhotosRequiredException extends DomainException {
  constructor() {
    super(
      { key: ShipmentErrorMessages.LinkOrPhotosRequired },
      HttpStatus.BAD_REQUEST,
      ShipmentErrorCodes.LinkOrPhotosRequired,
    );
  }
}

export class TooManyImagesException extends DomainException {
  constructor(max: number) {
    super(
      { key: ShipmentErrorMessages.TooManyImages, params: { max } },
      HttpStatus.BAD_REQUEST,
      ShipmentErrorCodes.TooManyImages,
    );
  }
}

export class CardExpiredException extends DomainException {
  constructor() {
    super(
      { key: ShipmentErrorMessages.CardExpired },
      HttpStatus.BAD_REQUEST,
      ShipmentErrorCodes.CardExpired,
    );
  }
}

/** The file doesn't exist, isn't attached to this shipment, or (customer access) belongs to another client. */
export class ShipmentFileNotFoundException extends DomainException {
  constructor() {
    super(
      { key: ShipmentErrorMessages.ShipmentFileNotFound },
      HttpStatus.NOT_FOUND,
      ShipmentErrorCodes.ShipmentFileNotFound,
    );
  }
}

/** The file exists but isn't deletable right now: wrong kind for this endpoint, wrong shipment status, or it's the client's last request photo with no product link to fall back on. */
export class ShipmentFileNotDeletableException extends DomainException {
  constructor() {
    super(
      { key: ShipmentErrorMessages.ShipmentFileNotDeletable },
      HttpStatus.CONFLICT,
      ShipmentErrorCodes.ShipmentFileNotDeletable,
    );
  }
}
