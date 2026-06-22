import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto';

describe('crypto', () => {
  const key = randomBytes(32);

  it('round-trips a secret', () => {
    const secret = 'super-secret-refresh-token-value';
    const encrypted = encryptSecret(secret, key);
    expect(encrypted).not.toBe(secret);
    expect(decryptSecret(encrypted, key)).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const secret = 'same-input';
    expect(encryptSecret(secret, key)).not.toBe(encryptSecret(secret, key));
  });

  it('fails to decrypt with the wrong key', () => {
    const encrypted = encryptSecret('value', key);
    expect(() => decryptSecret(encrypted, randomBytes(32))).toThrow();
  });

  it('fails to decrypt tampered ciphertext', () => {
    const encrypted = encryptSecret('value', key);
    const raw = Buffer.from(encrypted, 'base64');
    const lastIndex = raw.length - 1;
    raw[lastIndex] = (raw[lastIndex] ?? 0) ^ 0xff;
    expect(() => decryptSecret(raw.toString('base64'), key)).toThrow();
  });
});
