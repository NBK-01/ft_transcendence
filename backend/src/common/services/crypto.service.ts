import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing only — argon2id, not the template's bcrypt (the
 * template's own README advertises argon2, bcrypt was what actually got
 * wired up; argon2 is also what the OTP module hashes codes with, so this
 * keeps one KDF across the codebase instead of two).
 *
 * Deliberately does NOT include the template's AES-256-GCM
 * encrypt/decrypt-in-transit scheme — that assumes frontend coordination on
 * a specific encryption format we have no agreement on with the (separately
 * built) frontend. Passwords travel over HTTPS instead, which is already a
 * mandatory requirement.
 */
@Injectable()
export class CryptoService {
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
