import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { safeRedirect } from './redirect';
import { decrypt, deriveKey, encrypt, generateBackupCodes, normalizeBackupCode } from './secrets';
import { base32Decode, base32Encode, otpauthUrl, totpAt, verifyTotp } from './totp';

// RFC 6238 appendix B: secret "12345678901234567890", SHA-1, last 6 digits.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));
const RFC_VECTORS: Array<[number, string]> = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
];

describe('totp', () => {
  it.each(RFC_VECTORS)('matches RFC 6238 at t=%i', (seconds, code) => {
    expect(totpAt(RFC_SECRET, Math.floor(seconds / 30))).toBe(code);
  });

  it('accepts the previous and next window, not older ones', () => {
    const now = 1234567890 * 1000;
    const step = Math.floor(1234567890 / 30);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 2), now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abc123', now)).toBeNull();
  });

  it('round-trips base32', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 255, 17]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it('builds an otpauth link', () => {
    expect(otpauthUrl('Dev Pulse', 'mira@example.com', 'ABC')).toBe(
      'otpauth://totp/Dev%20Pulse%3Amira%40example.com?secret=ABC&issuer=Dev+Pulse&algorithm=SHA1&digits=6&period=30',
    );
  });
});

describe('password', () => {
  it('verifies the right password only', async () => {
    const hash = await hashPassword('correct horse 1');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse 1', hash)).toBe(true);
    expect(await verifyPassword('correct horse 2', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });
});

describe('secrets', () => {
  const key = deriveKey('x'.repeat(40), 'test');

  it('encrypts and decrypts', () => {
    const box = encrypt('JBSWY3DPEHPK3PXP', key);
    expect(box).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decrypt(box, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('rejects tampered data', () => {
    const [iv, tag, data] = encrypt('secret', key).split('.');
    const flipped = Buffer.from(data, 'base64url');
    flipped[0] ^= 1;
    expect(() => decrypt([iv, tag, flipped.toString('base64url')].join('.'), key)).toThrow();
  });

  it('derives different keys per purpose', () => {
    expect(deriveKey('s'.repeat(40), 'a').equals(deriveKey('s'.repeat(40), 'b'))).toBe(false);
  });

  it('makes readable backup codes', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
    expect(normalizeBackupCode(' K7M2Q-9XBTE ')).toBe('k7m2q9xbte');
  });
});

describe('safeRedirect', () => {
  it.each([
    ['/office', '/office'],
    ['/settings/security?tab=2fa', '/settings/security?tab=2fa'],
    ['https://evil.com', '/office'],
    ['//evil.com', '/office'],
    ['/\\evil.com', '/office'],
    [undefined, '/office'],
  ])('%s -> %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});
