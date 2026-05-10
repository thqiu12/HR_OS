import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * AES-256-GCM PII encryption.
 *
 * Format (compact):  iv.tag.ciphertext   (each part url-safe base64)
 *
 * Key derivation: scrypt(ENCRYPTION_KEY || AUTH_SECRET, "hr-os-pii", 32).
 * The key is computed once per process to avoid scrypt cost on every call.
 *
 * Production guidance: rotate by changing ENCRYPTION_KEY, then writing a
 * migration that decrypts with old key and re-encrypts with new key. Keep the
 * old key set as PRIOR_ENCRYPTION_KEY during the rollover window.
 */

const SALT = Buffer.from("hr-os-pii-v1");

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const material = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!material) throw new Error("ENCRYPTION_KEY (or AUTH_SECRET fallback) not set");
  cachedKey = scryptSync(material, SALT, 32);
  return cachedKey;
}

const b64u = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function encryptPII(plaintext: string): string {
  if (typeof plaintext !== "string") throw new TypeError("encryptPII expects a string");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${b64u(iv)}.${b64u(tag)}.${b64u(ct)}`;
}

export function decryptPII(token: string): string {
  if (!token || typeof token !== "string") throw new TypeError("decryptPII expects a non-empty string");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed ciphertext");
  const [ivStr, tagStr, ctStr] = parts;
  const iv = fromB64u(ivStr);
  const tag = fromB64u(tagStr);
  const ct = fromB64u(ctStr);
  if (iv.length !== 12) throw new Error("bad IV length");
  if (tag.length !== 16) throw new Error("bad tag length");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Mask a value for display, showing only last `keep` chars. */
export function maskPII(plaintext: string, keep = 4): string {
  if (!plaintext) return "";
  const tail = plaintext.slice(-keep);
  return "•".repeat(Math.max(0, plaintext.length - keep)) + tail;
}

/** TEST-ONLY: clears the cached key so tests can swap ENCRYPTION_KEY. */
export function _resetCryptoCacheForTests() {
  cachedKey = null;
}
