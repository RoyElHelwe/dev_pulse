/**
 * Time-based One-Time Password (TOTP) implementation per RFC 6238 and RFC 4226.
 * Provides Base32 encoding/decoding, TOTP calculation, drift-tolerant verification, and otpauth URI generation.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Time-based one-time passwords (RFC 6238): shared secret + 30-second time counter HMAC-SHA1.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;
// 20 bytes (160 bits) matches the SHA-1 output size recommended by RFC 6238.
const TOTP_SECRET_BYTES = 20;
const MS_PER_SECOND = 1000;

/** Encodes a binary buffer into an unpadded RFC 4648 Base32 string. */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Decodes a Base32 string into a binary Buffer, stripping padding and spaces. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generates a cryptographically random 20-byte TOTP secret key encoded as Base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(TOTP_SECRET_BYTES));
}

function currentStep(now = Date.now()): number {
  return Math.floor(now / MS_PER_SECOND / STEP_SECONDS);
}

/** Computes the 6-digit TOTP code for a secret and specific time counter step. */
export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return binary.toString().padStart(DIGITS, '0');
}

/** Verifies a TOTP code against the current step and +/-1 step to tolerate clock drift. */
export function verifyTotp(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const step = currentStep(now);
  // Tolerate +/-1 step (30 seconds) clock drift between client device and server.
  for (const candidate of [step, step - 1, step + 1]) {
    const expected = Buffer.from(totpAt(secret, candidate));
    if (timingSafeEqual(expected, Buffer.from(code))) return candidate;
  }
  return null;
}

/** Generates the standard otpauth:// URI encoded into QR codes for authenticator app enrollment. */
export function otpauthUrl(issuer: string, account: string, secret: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params}`;
}

