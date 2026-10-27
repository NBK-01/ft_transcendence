import { AccountType } from '../common/context/auth-context.types';

export const CHAT_SUPPORT_ACCESS_PERMISSION = 'chat:support:access';

/** The room each connection joins for its account: personal events (presence, notifications) go there. */
export const personalRoom = (account: {
  accountType: AccountType;
  id: string;
}): string => `user:${account.accountType}:${account.id}`;
