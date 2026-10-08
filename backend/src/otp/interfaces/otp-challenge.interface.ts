export interface OtpChallenge {
  hashedCode: string;
  identifier: string;
  attempts: number;
  createdAt: Date;
  expiresAt: Date;
  logId: number;
}
