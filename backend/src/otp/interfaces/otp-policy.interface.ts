export interface OtpPolicy {
  ttl: number; // seconds
  codeLength: number;
  maxAttempts: number;
  cooldownPeriod: number; // seconds between requests
  blockWindow: number; // seconds, block duration after max attempts
}
