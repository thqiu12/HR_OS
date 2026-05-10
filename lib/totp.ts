/**
 * RFC 6238 TOTP (Time-based One-Time Password) implementation.
 *
 * Generates 30-second 6-digit codes compatible with Google Authenticator,
 * Authy, 1Password, etc. We don't pull a third-party lib — TOTP is small.
 */

import { createHmac, randomBytes } from "crypto";

// RFC 4648 base32 alphabet
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const v = B32_ALPHABET.indexOf(c);
    if (v < 0) throw new Error("Invalid base32 character");
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Generate a fresh TOTP secret. Returns base32-encoded for QR provisioning. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Compute TOTP code for the given secret at a given Unix-timestamp (or now). */
export function totpCode(secret: string, when: number = Date.now()): string {
  const counter = Math.floor(when / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

/** Verify a user-submitted TOTP code with ±1 step (30s) clock skew tolerance. */
export function verifyTotp(secret: string, submitted: string): boolean {
  if (!/^\d{6}$/.test(submitted)) return false;
  const now = Date.now();
  for (const skew of [-1, 0, 1]) {
    if (totpCode(secret, now + skew * 30 * 1000) === submitted) return true;
  }
  return false;
}

/**
 * Build an `otpauth://` URI for QR provisioning.
 * Most authenticator apps will read this directly.
 */
export function totpProvisionUri(opts: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.account}`);
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
