import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum ChatErrorCodes {
  ConversationNotFound = 11001,
  NotConversationParticipant = 11002,
  StaffNotConnected = 11003,
  WsAuthenticationFailed = 11004,
}

export enum ChatErrorMessages {
  ConversationNotFound = 'errors.CONVERSATION_NOT_FOUND',
  NotConversationParticipant = 'errors.NOT_CONVERSATION_PARTICIPANT',
  StaffNotConnected = 'errors.STAFF_NOT_CONNECTED',
  WsAuthenticationFailed = 'errors.WS_AUTHENTICATION_FAILED',
}

export class ConversationNotFoundException extends DomainException {
  constructor(id: string) {
    super(
      { key: ChatErrorMessages.ConversationNotFound, params: { id } },
      HttpStatus.NOT_FOUND,
      ChatErrorCodes.ConversationNotFound,
    );
  }
}

export class NotConversationParticipantException extends DomainException {
  constructor() {
    super(
      { key: ChatErrorMessages.NotConversationParticipant },
      HttpStatus.FORBIDDEN,
      ChatErrorCodes.NotConversationParticipant,
    );
  }
}

/** Thrown when a staff DM's connecting contact has since been blocked or removed. */
export class StaffNotConnectedException extends DomainException {
  constructor() {
    super(
      { key: ChatErrorMessages.StaffNotConnected },
      HttpStatus.FORBIDDEN,
      ChatErrorCodes.StaffNotConnected,
    );
  }
}

/** Thrown by ConnectionAuthenticator — missing/invalid/expired token, wrong token type, or an inactive account. */
export class WsAuthenticationException extends DomainException {
  constructor() {
    super(
      { key: ChatErrorMessages.WsAuthenticationFailed },
      HttpStatus.UNAUTHORIZED,
      ChatErrorCodes.WsAuthenticationFailed,
    );
  }
}
