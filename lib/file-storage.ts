import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

/**
 * Encrypted-at-rest file storage.
 *
 * Files are encrypted with AES-256-GCM and written to uploadsDir() (default
 * ./uploads). The IV and auth tag are stored separately (in the DB row, not
 * the file) so the file on disk reveals nothing useful.
 *
 * Storage layout: <uploadsDir()>/<scope>/<random>.enc
 */

// Read at call time so tests can override via process.env after import
const uploadsDir = () => process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
const SALT = Buffer.from("hr-os-files-v1");
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB hard cap per file

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const material = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!material) throw new Error("ENCRYPTION_KEY (or AUTH_SECRET fallback) not set");
  cachedKey = scryptSync(material, SALT, 32);
  return cachedKey;
}

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

export type SavedFile = {
  storageKey: string;
  originalName: string;
  contentType: string | null;
  sizeBytes: number;
  sha256: string;
  iv: string;
  authTag: string;
};

export async function saveEncryptedFile(opts: {
  scope: string;             // e.g. "case_o1" / "candidate_c1" — used for subdir
  originalName: string;
  contentType?: string | null;
  data: Buffer;
}): Promise<SavedFile> {
  const { scope, originalName, contentType = null, data } = opts;
  if (data.byteLength > MAX_FILE_BYTES) {
    throw new Error(`file too large (${data.byteLength} bytes; max ${MAX_FILE_BYTES})`);
  }
  if (data.byteLength === 0) throw new Error("empty file");

  const sha256 = createHash("sha256").update(data).digest("hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  const safeScope = scope.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = path.join(uploadsDir(), safeScope);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${randomBytes(12).toString("hex")}.enc`;
  const fullPath = path.join(dir, fileName);
  await fs.writeFile(fullPath, ciphertext, { mode: 0o600 });

  return {
    storageKey: path.join(safeScope, fileName),
    originalName,
    contentType,
    sizeBytes: data.byteLength,
    sha256,
    iv: b64u(iv),
    authTag: b64u(tag),
  };
}

export async function loadDecryptedFile(row: { storageKey: string; iv: string; authTag: string; sha256: string }): Promise<Buffer> {
  const fullPath = path.join(uploadsDir(), row.storageKey);
  if (!existsSync(fullPath)) throw new Error(`file missing on disk: ${row.storageKey}`);
  // Path-traversal guard: resolved path must stay under uploadsDir()
  const resolved = path.resolve(fullPath);
  const root = path.resolve(uploadsDir());
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("invalid storage key (path traversal)");
  }
  const ct = await fs.readFile(fullPath);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), fromB64u(row.iv));
  decipher.setAuthTag(fromB64u(row.authTag));
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  // Verify content hash matches what we stored — defends against on-disk tampering
  const actual = createHash("sha256").update(pt).digest("hex");
  if (actual !== row.sha256) throw new Error("file integrity check failed");
  return pt;
}

export async function deleteStoredFile(storageKey: string) {
  const fullPath = path.join(uploadsDir(), storageKey);
  try { await fs.unlink(fullPath); } catch { /* ignore */ }
}

export const _FOR_TESTS = { uploadsDir, MAX_FILE_BYTES };
export function _resetFileStorageKeyForTests() { cachedKey = null; }
