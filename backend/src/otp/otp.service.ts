import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { OtpConfigService } from './config/otp-config.service';
import { OtpChallenge } from './interfaces/otp-challenge.interface';
import {
  OtpNotFoundException,
  OtpInvalidException,
  OtpBlockedException,
} from './exceptions';
import {
  RequestRecord,
  ViolationRecord,
} from './interfaces/progressive-policy.interface';
import { OtpProgressiveBlockException } from './exceptions/progressive-block.exception';
import { CommunicationService } from '../communication/communication.service';
import {
  OtpLog,
  OtpChannel,
  OtpPurpose,
  OtpStatus,
} from './entities/otp-log.entity';
import { EmailTemplates } from '../common/templates/email-templates';

/**
 * Trimmed from the source template: email-only (no SMS/WhatsApp — nothing in
 * this project sends either yet). Everything else — argon2-hashed codes,
 * Redis challenge storage, progressive multi-tier rate limiting, DB audit
 * log — is ported faithfully.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly otpConfigService: OtpConfigService,
    private readonly communicationService: CommunicationService,
    @InjectRepository(OtpLog)
    private readonly otpLogRepository: Repository<OtpLog>,
  ) {}

  async requestOtp(
    identifier: string,
    prefix: string,
    purpose: OtpPurpose = OtpPurpose.ACCOUNT_VERIFICATION,
  ): Promise<{ success: boolean; expiresIn: number }> {
    if (!this.otpConfigService.isEnabled()) {
      throw new Error('OTP system is currently disabled');
    }

    const policy = this.otpConfigService.getPolicy();

    await this.checkProgressiveLimits(identifier, prefix);
    await this.checkBlockStatus(identifier, prefix);

    const code = this.generateCode(policy.codeLength);
    const hashedCode = await this.hashCode(code);

    const logEntry = await this.otpLogRepository.save({
      identifier: identifier.toLowerCase().trim(),
      channel: OtpChannel.EMAIL,
      purpose,
      status: OtpStatus.SENT,
      attempts: 0,
    });

    const challenge: OtpChallenge = {
      hashedCode,
      identifier: identifier.toLowerCase().trim(),
      attempts: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + policy.ttl * 1000),
      logId: logEntry.id,
    };

    try {
      await this.storeChallenge(identifier, challenge, prefix);
      await this.sendOtpEmail(identifier, code, policy.ttl);
      await this.recordProgressiveRequest(identifier, prefix);
      return { success: true, expiresIn: policy.ttl };
    } catch (error) {
      await this.deleteChallenge(identifier, prefix);
      throw error;
    }
  }

  async verifyOtp(
    identifier: string,
    code: string,
    prefix: string,
    userId?: string,
  ): Promise<boolean> {
    const challenge = await this.retrieveChallenge(identifier, prefix);
    if (!challenge) {
      await this.markOtpAsExpired(identifier);
      throw new OtpNotFoundException(identifier);
    }

    const isValid = await this.verifyCode(code, challenge.hashedCode);

    if (isValid) {
      await this.otpLogRepository.update(challenge.logId, {
        status: OtpStatus.VERIFIED,
        attempts: challenge.attempts + 1,
        verifiedAt: new Date(),
        userId: userId ?? null,
      });
      const deleted = await this.deleteChallenge(identifier, prefix);
      if (deleted === 0) {
        throw new Error('OTP challenge was already consumed or expired');
      }
      return true;
    }

    challenge.attempts++;
    const policy = this.otpConfigService.getPolicy();
    await this.otpLogRepository.update(challenge.logId, {
      attempts: challenge.attempts,
    });

    if (challenge.attempts >= policy.maxAttempts) {
      await this.otpLogRepository.update(challenge.logId, {
        status: OtpStatus.FAILED,
      });
      await this.blockUser(identifier, prefix);
      await this.deleteChallenge(identifier, prefix);
      throw new OtpBlockedException(policy.blockWindow);
    }

    await this.storeChallenge(identifier, challenge, prefix);
    throw new OtpInvalidException();
  }

  async invalidateOtp(identifier: string, prefix: string): Promise<boolean> {
    return (await this.deleteChallenge(identifier, prefix)) > 0;
  }

  // ==================== Redis key management ====================

  private getRedisKey(
    identifier: string,
    type: 'challenge' | 'block',
    prefix: string,
  ): string {
    return `${prefix}:${type}:${identifier.toLowerCase().trim()}`;
  }

  private getChallengeKey(identifier: string, prefix: string): string {
    return this.getRedisKey(identifier, 'challenge', prefix);
  }

  private getBlockKey(identifier: string, prefix: string): string {
    return this.getRedisKey(identifier, 'block', prefix);
  }

  // ==================== Redis operations ====================

  private async storeChallenge(
    identifier: string,
    challenge: OtpChallenge,
    prefix: string,
  ): Promise<void> {
    const { ttl } = this.otpConfigService.getPolicy();
    await this.redis.setex(
      this.getChallengeKey(identifier, prefix),
      ttl,
      JSON.stringify(challenge),
    );
  }

  private async retrieveChallenge(
    identifier: string,
    prefix: string,
  ): Promise<OtpChallenge | null> {
    const key = this.getChallengeKey(identifier, prefix);
    const data = await this.redis.get(key);
    if (!data) {
      return null;
    }
    try {
      return JSON.parse(data) as OtpChallenge;
    } catch {
      await this.redis.del(key);
      return null;
    }
  }

  private async deleteChallenge(
    identifier: string,
    prefix: string,
  ): Promise<number> {
    return this.redis.del(this.getChallengeKey(identifier, prefix));
  }

  // ==================== Rate limiting ====================

  private async checkBlockStatus(
    identifier: string,
    prefix: string,
  ): Promise<void> {
    const blockKey = this.getBlockKey(identifier, prefix);
    const isBlocked = await this.redis.get(blockKey);
    if (isBlocked) {
      const ttl = await this.redis.ttl(blockKey);
      const policy = this.otpConfigService.getPolicy();
      throw new OtpBlockedException(ttl > 0 ? ttl : policy.blockWindow);
    }
  }

  private async blockUser(identifier: string, prefix: string): Promise<void> {
    const { blockWindow } = this.otpConfigService.getPolicy();
    await this.redis.setex(
      this.getBlockKey(identifier, prefix),
      blockWindow,
      'blocked',
    );
  }

  // ==================== Progressive request limiting ====================

  private async checkProgressiveLimits(
    identifier: string,
    prefix: string,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const policy = this.otpConfigService.getProgressivePolicy();
    const record = await this.getProgressiveRecord(identifier, prefix);

    const activeBlock = record.violations.find((v) => v.blockUntil > now);
    if (activeBlock) {
      this.throwProgressiveBlock(
        activeBlock.tier,
        activeBlock.blockUntil - now,
        activeBlock.blockUntil,
        activeBlock.period,
        activeBlock.maxRequests,
      );
    }

    for (let i = 0; i < policy.tiers.length; i++) {
      const tier = policy.tiers[i];
      const periodStart = now - tier.period;
      const requestsInPeriod = record.requests.filter(
        (t) => t >= periodStart,
      ).length;

      if (requestsInPeriod >= tier.maxRequests) {
        const blockUntil = now + tier.blockDuration;
        await this.recordProgressiveViolation(identifier, prefix, {
          tier: i + 1,
          timestamp: now,
          blockUntil,
          period: tier.period,
          maxRequests: tier.maxRequests,
        });
        this.throwProgressiveBlock(
          i + 1,
          tier.blockDuration,
          blockUntil,
          tier.period,
          tier.maxRequests,
        );
      }
    }
  }

  private throwProgressiveBlock(
    tier: number,
    waitTimeSeconds: number,
    blockUntil: number,
    period: number,
    maxRequests: number,
  ): never {
    const periodHours = Math.round((period / 3600) * 10) / 10;
    throw new OtpProgressiveBlockException({
      tier,
      waitTimeSeconds,
      nextAttemptAt: new Date(blockUntil * 1000).toISOString(),
      tierDescription: `${periodHours}-hour rate limit`,
      violatedLimit: maxRequests,
      violatedPeriod: period,
    });
  }

  private async recordProgressiveRequest(
    identifier: string,
    prefix: string,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const record = await this.getProgressiveRecord(identifier, prefix);
    record.requests.push(now);
    const oneWeekAgo = now - 604800;
    record.requests = record.requests.filter((t) => t >= oneWeekAgo);
    await this.storeProgressiveRecord(identifier, prefix, record);
  }

  private async getProgressiveRecord(
    identifier: string,
    prefix: string,
  ): Promise<RequestRecord> {
    const key = this.getProgressiveRedisKey(identifier, prefix);
    const data = await this.redis.get(key);
    const empty = (): RequestRecord => ({
      identifier,
      prefix,
      requests: [],
      violations: [],
      lastCleanup: Math.floor(Date.now() / 1000),
    });
    if (!data) {
      return empty();
    }
    try {
      return JSON.parse(data) as RequestRecord;
    } catch {
      return empty();
    }
  }

  private async storeProgressiveRecord(
    identifier: string,
    prefix: string,
    record: RequestRecord,
  ): Promise<void> {
    record.lastCleanup = Math.floor(Date.now() / 1000);
    await this.redis.setex(
      this.getProgressiveRedisKey(identifier, prefix),
      604800,
      JSON.stringify(record),
    );
  }

  private async recordProgressiveViolation(
    identifier: string,
    prefix: string,
    violation: ViolationRecord,
  ): Promise<void> {
    const record = await this.getProgressiveRecord(identifier, prefix);
    record.violations.push(violation);
    const oneWeekAgo = Math.floor(Date.now() / 1000) - 604800;
    record.violations = record.violations.filter(
      (v) => v.timestamp >= oneWeekAgo,
    );
    await this.storeProgressiveRecord(identifier, prefix, record);
  }

  private getProgressiveRedisKey(identifier: string, prefix: string): string {
    return `${prefix}:progressive:${identifier.toLowerCase().trim()}`;
  }

  // ==================== Generation, hashing, delivery ====================

  private generateCode(length: number): string {
    return randomInt(0, Math.pow(10, length)).toString().padStart(length, '0');
  }

  private async hashCode(code: string): Promise<string> {
    return argon2.hash(code, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
  }

  private async verifyCode(code: string, hashedCode: string): Promise<boolean> {
    try {
      return await argon2.verify(hashedCode, code);
    } catch (error) {
      this.logger.error(
        `Argon2 verification error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private async sendOtpEmail(
    identifier: string,
    code: string,
    ttlSeconds: number,
  ): Promise<void> {
    const ttlMinutes = Math.floor(ttlSeconds / 60);
    const { subject, html } = EmailTemplates.otpVerification(code, ttlMinutes);
    await this.communicationService.sendEmail(identifier, subject, html);
  }

  private async markOtpAsExpired(identifier: string): Promise<void> {
    try {
      const { ttl } = this.otpConfigService.getPolicy();
      const cutoffTime = new Date(Date.now() - ttl * 1000);
      await this.otpLogRepository
        .createQueryBuilder()
        .update(OtpLog)
        .set({ status: OtpStatus.EXPIRED })
        .where({
          identifier: identifier.toLowerCase().trim(),
          status: OtpStatus.SENT,
          sentAt: MoreThan(cutoffTime),
        })
        .execute();
    } catch {
      // best effort
    }
  }
}
