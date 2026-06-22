import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Encrypts a UTF-8 secret with AES-256-GCM. The returned base64 payload packs
 * the IV, the auth tag, and the ciphertext: `base64(iv || tag || ciphertext)`.
 */
export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Reverses {@link encryptSecret}. Throws if the payload was tampered with. */
export function decryptSecret(payload: string, key: Buffer): string {
  const raw = Buffer.from(payload, 'base64');
  if (raw.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Encrypted payload is too short to be valid');
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
