import { describe, it, expect, beforeAll } from "vitest";
import { saveEncryptedFile, loadDecryptedFile, deleteStoredFile, _resetFileStorageKeyForTests } from "@/lib/file-storage";
import { randomBytes } from "crypto";
import path from "path";
import os from "os";
import fs from "fs/promises";

beforeAll(() => {
  // Use a unique uploads dir for these tests
  process.env.UPLOADS_DIR = path.join(os.tmpdir(), `hr-os-uploads-${randomBytes(4).toString("hex")}`);
  _resetFileStorageKeyForTests();
});

describe("file storage (AES-256-GCM at rest)", () => {
  it("round-trips a small text file", async () => {
    const data = Buffer.from("これはテスト用の書類です。My Number: 1234-5678-9012", "utf8");
    const saved = await saveEncryptedFile({
      scope: "case_o1",
      originalName: "test.txt",
      contentType: "text/plain",
      data,
    });
    expect(saved.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(saved.iv).toBeTruthy();
    expect(saved.authTag).toBeTruthy();
    const decrypted = await loadDecryptedFile(saved);
    expect(decrypted.equals(data)).toBe(true);
  });

  it("round-trips a binary blob", async () => {
    const data = randomBytes(8192);
    const saved = await saveEncryptedFile({ scope: "case_o2", originalName: "blob.bin", data });
    const decrypted = await loadDecryptedFile(saved);
    expect(decrypted.equals(data)).toBe(true);
  });

  it("ciphertext on disk does NOT contain the plaintext", async () => {
    const data = Buffer.from("HIGHLY_CONFIDENTIAL_MY_NUMBER_9999_8888_7777", "utf8");
    const saved = await saveEncryptedFile({ scope: "case_secret", originalName: "secret.txt", data });
    const ct = await fs.readFile(path.join(process.env.UPLOADS_DIR!, saved.storageKey));
    expect(ct.includes(data)).toBe(false);
    expect(ct.includes(Buffer.from("HIGHLY_CONFIDENTIAL"))).toBe(false);
  });

  it("rejects empty files", async () => {
    await expect(saveEncryptedFile({ scope: "x", originalName: "e.bin", data: Buffer.alloc(0) }))
      .rejects.toThrow(/empty/);
  });

  it("rejects oversized files", async () => {
    const huge = Buffer.alloc(26 * 1024 * 1024);
    await expect(saveEncryptedFile({ scope: "x", originalName: "huge.bin", data: huge }))
      .rejects.toThrow(/too large/);
  });

  it("detects on-disk tampering via auth tag", async () => {
    const data = Buffer.from("important", "utf8");
    const saved = await saveEncryptedFile({ scope: "tamper_test", originalName: "x.txt", data });
    const fp = path.join(process.env.UPLOADS_DIR!, saved.storageKey);
    const ct = await fs.readFile(fp);
    ct[0] = ct[0] ^ 0xff;
    await fs.writeFile(fp, ct);
    await expect(loadDecryptedFile(saved)).rejects.toThrow();
  });

  it("delete removes the file from disk", async () => {
    const saved = await saveEncryptedFile({ scope: "del", originalName: "d.txt", data: Buffer.from("bye") });
    await deleteStoredFile(saved.storageKey);
    await expect(loadDecryptedFile(saved)).rejects.toThrow(/missing/);
  });

  it("sanitizes the scope name (no path traversal)", async () => {
    const saved = await saveEncryptedFile({
      scope: "case/../escape",
      originalName: "s.txt",
      data: Buffer.from("ok"),
    });
    // Slashes and dots in the scope are replaced with underscores
    expect(saved.storageKey).not.toContain("..");
    // 4 special chars in "case/../escape" → 4 underscores
    expect(saved.storageKey.split(path.sep)[0]).toBe("case____escape");
    const decrypted = await loadDecryptedFile(saved);
    expect(decrypted.toString()).toBe("ok");
  });
});
