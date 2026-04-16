import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * argon2id parameters — OWASP Password Storage Cheat Sheet recommendation
 * (2025). Memory: 19 MiB, time: 2 iterations, parallelism: 1.
 * These can be tuned up as hardware improves, but hashes remain verifiable
 * because argon2 encodes params in the hash string.
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Password hashing using argon2id — the current OWASP recommendation.
 *
 * Replaces bcrypt in BOS (BRD mentioned bcrypt cost 12; we upgraded to
 * argon2id which is strictly stronger and future-proof). Hash strings are
 * self-describing (`$argon2id$v=19$m=19456,t=2,p=1$...`) so param upgrades
 * are backward-compatible — old hashes still verify.
 *
 * @example
 *   const hash = await hasher.hash('plaintext');
 *   const ok = await hasher.verify(hash, 'plaintext');
 */
@Injectable()
export class PasswordHasherService {
  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, ARGON2_OPTIONS);
  }

  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      return false;
    }
  }

  /**
   * Returns true if the hash was produced with parameters weaker than
   * current defaults and should be re-hashed next time the user
   * authenticates successfully.
   */
  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, ARGON2_OPTIONS);
    } catch {
      return true;
    }
  }
}
