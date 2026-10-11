/**
 * Password hashing and verification using Node.js built-in scrypt algorithm.
 * Applies memory-hard key derivation with per-password salts and constant-time equality comparisons.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// scrypt memory-hard parameters resist ASIC and GPU brute-force attacks.
// Stored format: scrypt$N$r$p$salt$hash (base64), allowing work factors to increase over time.
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const DERIVED_KEY_LENGTH_BYTES = 64;
const SALT_LENGTH_BYTES = 16;
const MAX_MEMORY_BYTES = 128 * SCRYPT_N * SCRYPT_R * 2;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    // NFKC normalization ensures identical visual characters with different byte encodings match consistently.
    scrypt(password.normalize('NFKC'), salt, DERIVED_KEY_LENGTH_BYTES, options, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

/** Hashes a plaintext password with a fresh random salt using memory-hard scrypt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH_BYTES);
  const hash = await derive(password, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY_BYTES });
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64'), hash.toString('base64')].join('$');
}

/** Verifies a plaintext password against a stored scrypt hash string in constant time. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, hash] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * Number(n) * Number(r) * 2,
  });
  // Constant-time comparison prevents timing side-channel attacks on the password hash.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

