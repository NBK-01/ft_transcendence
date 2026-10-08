import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPolicy } from '../interfaces/otp-policy.interface';
import { ProgressivePolicy } from '../interfaces/progressive-policy.interface';

@Injectable()
export class OtpConfigService {
  constructor(private readonly configService: ConfigService) {}

  getPolicy(): OtpPolicy {
    return {
      ttl: this.configService.get<number>('OTP_TTL', 300),
      codeLength: this.configService.get<number>('OTP_CODE_LENGTH', 6),
      maxAttempts: this.configService.get<number>('OTP_MAX_ATTEMPTS', 3),
      cooldownPeriod: this.configService.get<number>('OTP_COOLDOWN_PERIOD', 60),
      blockWindow: this.configService.get<number>('OTP_BLOCK_WINDOW', 900),
    };
  }

  isEnabled(): boolean {
    return this.configService.get<string>('OTP_ENABLED', 'true') !== 'false';
  }

  /** Each tier: N requests within a period trips a block of `blockDuration`, most restrictive first. */
  getProgressivePolicy(): ProgressivePolicy {
    return {
      tiers: [
        { period: 3600, maxRequests: 10, blockDuration: 3600 }, // 10 / hour -> 1hr block
        { period: 14400, maxRequests: 20, blockDuration: 14400 }, // 20 / 4hrs -> 4hr block
        { period: 86400, maxRequests: 30, blockDuration: 86400 }, // 30 / 24hrs -> 24hr block
        { period: 604800, maxRequests: 40, blockDuration: 604800 }, // 40 / week -> 1wk block
      ],
    };
  }
}
