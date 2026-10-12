/**
 * Cryptographic helpers for token generation, hashing, key derivation, and symmetric encryption.
 * Implements HKDF key derivation, AES-256-GCM authenticated encryption, and human-friendly backup code generation.
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

const DEFAULT_TOKEN_BYTES = 32;
const DERIVED_KEY_LENGTH_BYTES = 32;
// 12-byte (96-bit) IV is the standard recommended nonce length for AES-GCM (NIST SP 800-38D).
const AES_GCM_IV_LENGTH_BYTES = 12;
const DEFAULT_BACKUP_CODES_COUNT = 10;
const BACKUP_CODE_RAW_BYTES = 10;
const BACKUP_CODE_CHUNK_LENGTH = 5;

// Excludes easily confused characters: 0/o, 1/l/i to prevent user entry errors.
const BACKUP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Generates a cryptographically secure URL-safe random token string. */
export function randomToken(bytes = DEFAULT_TOKEN_BYTES): string {
  return randomBytes(bytes).toString('base64url');
}

/** Computes a SHA-256 hex digest to store tokens securely without exposing raw values to DB leaks. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Derives a purpose-specific 32-byte key from the master secret via HKDF to prevent cross-feature key reuse. */
export function deriveKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'dev-pulse', purpose, DERIVED_KEY_LENGTH_BYTES));
}

/** Encrypts plaintext using AES-256-GCM authenticated encryption, returning iv.tag.ciphertext in base64url. */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(AES_GCM_IV_LENGTH_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

/** Decrypts and authenticates an AES-256-GCM payload in iv.tag.ciphertext format. */
export function decrypt(payload: string, key: Buffer): string {
  const [iv, tag, data] = payload.split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Generates formatted one-time recovery backup codes (e.g. "k7m2q-9xbte"). */
export function generateBackupCodes(count = DEFAULT_BACKUP_CODES_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const chars = Array.from(randomBytes(BACKUP_CODE_RAW_BYTES), (b) => BACKUP_ALPHABET[b % BACKUP_ALPHABET.length]);
    return `${chars.slice(0, BACKUP_CODE_CHUNK_LENGTH).join('')}-${chars.slice(BACKUP_CODE_CHUNK_LENGTH).join('')}`;
  });
}

/** Normalizes user-submitted backup codes by lowercasing and stripping whitespace and punctuation. */
export function normalizeBackupCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

