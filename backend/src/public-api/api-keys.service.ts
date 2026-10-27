import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Or, Repository } from 'typeorm';
import { createHmac, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Organization } from '../organizations/organization.entity';
import { OrganizationNotFoundException } from '../organizations/exceptions';
import { ApiKey } from './entities/api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ListApiKeysQueryDto } from './dto/list-api-keys-query.dto';
import { ApiKeyDto, CreatedApiKeyDto } from './dto/api-key.dto';
import {
  ApiKeyFactory,
  ApiKeyWithRelations,
} from './factories/api-key.factory';
import {
  ApiKeyBranchInactiveException,
  ApiKeyNotFoundException,
} from './exceptions';
import { ActionSignals, ApiKeySignal } from '../notifications/action-signals';
import {
  API_KEY_BCRYPT_ROUNDS,
  API_KEY_HMAC_SECRET_MIN_LENGTH,
  API_KEY_PATTERN,
  API_KEY_PREFIX,
  API_KEY_RANDOM_BYTES,
  API_KEY_VISIBLE_PREFIX_LENGTH,
  ApiKeyRejection,
  LAST_USED_WRITE_INTERVAL_MS,
} from './constants/api-key.constants';

/** Who a valid key lets in: the key and the branch it acts for. */
export interface ApiKeyPrincipal {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
}

/** A key identify() found usable: with its (active) branch. */
export type IdentifiedApiKey = ApiKey & { organization: Organization };

/** identify(): the key's record, found by its HMAC, before the bcrypt check. */
export type ApiKeyLookup =
  | { valid: true; record: IdentifiedApiKey }
  | { valid: false; reason: ApiKeyRejection };

/** confirm(): the bcrypt check passed or not. */
export type ApiKeyVerification =
  | { valid: true; apiKey: ApiKeyPrincipal }
  | { valid: false; reason: ApiKeyRejection };

/**
 * API keys for partner systems: the admin side (create, list, revoke) and
 * the checks the public API's guard runs on every request (identify, then
 * confirm, then touchLastUsed).
 *
 * The plaintext key exists only in create()'s return value and in the
 * partner's requests. It is never stored or logged.
 */
@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);
  private readonly hmacSecret: string;
  /** When this instance last wrote lastUsedAt, per key id (ms since epoch). */
  private readonly lastUsedWrites = new Map<string, number>();

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    // Only read: the branch a new key is for.
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    configService: ConfigService,
    // The other admins hear about a key created or revoked (notifications).
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.hmacSecret = readHmacSecret(configService);
  }

  /* ---------------------------------------------------------------------
   * Admin side
   * ------------------------------------------------------------------- */

  /** Returns the full key this once; afterwards only its masked form exists. */
  async create(
    dto: CreateApiKeyDto,
    createdById: string,
  ): Promise<CreatedApiKeyDto> {
    const organization = await this.organizationRepository.findOne({
      where: { id: dto.organizationId },
    });
    if (!organization) {
      throw new OrganizationNotFoundException(dto.organizationId);
    }
    if (!organization.isActive) {
      throw new ApiKeyBranchInactiveException(organization.name);
    }

    const key = `${API_KEY_PREFIX}${randomBytes(API_KEY_RANDOM_BYTES).toString('hex')}`;
    const saved = await this.apiKeyRepository.save(
      this.apiKeyRepository.create({
        name: dto.name,
        organizationId: organization.id,
        prefix: key.slice(0, API_KEY_VISIBLE_PREFIX_LENGTH),
        last4: key.slice(-4),
        keyHash: await bcrypt.hash(key, API_KEY_BCRYPT_ROUNDS),
        keyHmac: this.hmac(key),
        createdById,
      }),
    );
    const apiKey = await this.findWithRelations(saved.id);
    if (!apiKey) {
      throw new ApiKeyNotFoundException(saved.id);
    }
    const record = ApiKeyFactory.toDto(apiKey);
    this.signal(ActionSignals.API_KEY_CREATED, record);
    return { ...record, key };
  }

  /** Newest first, revoked ones included. */
  async list(query: ListApiKeysQueryDto): Promise<ApiKeyDto[]> {
    const apiKeys = await this.apiKeyRepository.find({
      where: query.organizationId
        ? { organizationId: query.organizationId }
        : {},
      relations: { organization: true, createdBy: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return ApiKeyFactory.toDtoArray(apiKeys as ApiKeyWithRelations[]);
  }

  /**
   * The key stops working at once. Idempotent: revoking a revoked key
   * changes nothing and returns it with its first revokedAt, so a retried
   * or double-clicked DELETE isn't an error and the date stays true.
   */
  async revoke(id: string): Promise<ApiKeyDto> {
    // Conditional, so two revokes at once can't overwrite the first date.
    const result = await this.apiKeyRepository.update(
      { id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    const apiKey = await this.findWithRelations(id);
    if (!apiKey) {
      throw new ApiKeyNotFoundException(id);
    }
    const dto = ApiKeyFactory.toDto(apiKey);
    // Only the revoke that changed it: revoking again tells no one.
    if (result.affected) {
      this.signal(ActionSignals.API_KEY_REVOKED, dto);
    }
    return dto;
  }

  /* ---------------------------------------------------------------------
   * Request side (the public API's guard)
   * ------------------------------------------------------------------- */

  /**
   * Step 1, no bcrypt: finds the key by its HMAC (one indexed lookup,
   * whatever the number of keys) and checks it may still be used. The HMAC
   * is keyed with API_KEY_HMAC_SECRET, so it only finds the row for the
   * exact key: REVOKED and BRANCH_INACTIVE still only go to someone holding
   * the real key, and anything else is INVALID. The guard rate-limits the
   * key next, so bcrypt (confirm) only runs for requests that will be served.
   */
  async identify(key: string): Promise<ApiKeyLookup> {
    if (!API_KEY_PATTERN.test(key)) {
      return { valid: false, reason: ApiKeyRejection.INVALID };
    }
    const record = await this.apiKeyRepository.findOne({
      where: { keyHmac: this.hmac(key) },
      relations: { organization: true },
    });
    if (!record) {
      return { valid: false, reason: ApiKeyRejection.INVALID };
    }
    if (record.revokedAt) {
      return { valid: false, reason: ApiKeyRejection.REVOKED };
    }
    if (!record.organization?.isActive) {
      return { valid: false, reason: ApiKeyRejection.BRANCH_INACTIVE };
    }
    return { valid: true, record: record as IdentifiedApiKey };
  }

  /** Step 2: the key against its bcrypt hash, and who it lets in. */
  async confirm(
    key: string,
    record: IdentifiedApiKey,
  ): Promise<ApiKeyVerification> {
    if (!(await bcrypt.compare(key, record.keyHash))) {
      return { valid: false, reason: ApiKeyRejection.INVALID };
    }
    return {
      valid: true,
      apiKey: {
        id: record.id,
        name: record.name,
        organizationId: record.organization.id,
        organizationName: record.organization.name,
      },
    };
  }

  /**
   * Records that the key was just used, writing at most once a minute per
   * key: skipped in memory when this instance wrote it less than a minute
   * ago, and the UPDATE only matches a stored value at least a minute old
   * (so several app instances don't each write it). Never throws: a missed
   * lastUsedAt mustn't fail the partner's request. Returns whether it wrote.
   */
  async touchLastUsed(id: string): Promise<boolean> {
    const now = Date.now();
    const lastWrite = this.lastUsedWrites.get(id);
    if (
      lastWrite !== undefined &&
      now - lastWrite < LAST_USED_WRITE_INTERVAL_MS
    ) {
      return false;
    }
    // Set before the await, so requests arriving meanwhile skip too.
    this.lastUsedWrites.set(id, now);
    try {
      const result = await this.apiKeyRepository.update(
        {
          id,
          lastUsedAt: Or(
            IsNull(),
            LessThanOrEqual(new Date(now - LAST_USED_WRITE_INTERVAL_MS)),
          ),
        },
        { lastUsedAt: new Date(now) },
      );
      return Boolean(result.affected);
    } catch (error) {
      this.logger.warn(
        `Could not record API key ${id} as used: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /* ---------------------------------------------------------------------
   * Internals
   * ------------------------------------------------------------------- */

  private async findWithRelations(
    id: string,
  ): Promise<ApiKeyWithRelations | null> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id },
      relations: { organization: true, createdBy: true },
    });
    return apiKey as ApiKeyWithRelations | null;
  }

  /** Emitted once the write is done (save and update commit on their own). */
  private signal(
    name: (typeof ActionSignals)['API_KEY_CREATED' | 'API_KEY_REVOKED'],
    dto: ApiKeyDto,
  ): void {
    const signal: ApiKeySignal = {
      apiKeyId: dto.id,
      name: dto.name,
      organizationId: dto.organization.id,
      branchName: dto.organization.name,
      maskedKey: dto.maskedKey,
    };
    this.eventEmitter.emit(name, signal);
  }

  private hmac(key: string): string {
    return createHmac('sha256', this.hmacSecret).update(key).digest('hex');
  }
}

/** Checked at boot, so a missing secret stops the app instead of failing every key later. */
function readHmacSecret(configService: ConfigService): string {
  const secret = configService.get<string>('API_KEY_HMAC_SECRET');
  if (!secret || secret.length < API_KEY_HMAC_SECRET_MIN_LENGTH) {
    throw new Error(
      `API_KEY_HMAC_SECRET must be set to at least ${API_KEY_HMAC_SECRET_MIN_LENGTH} characters. ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  return secret;
}
