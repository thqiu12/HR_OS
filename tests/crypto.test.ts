import { describe, it, expect, beforeAll } from "vitest";
import { encryptPII, decryptPII, maskPII, _resetCryptoCacheForTests } from "@/lib/crypto";

beforeAll(() => {
  _resetCryptoCacheForTests();
});

describe("AES-256-GCM PII encryption", () => {
  it("round-trips a Japanese MyNumber", () => {
    const pt = "1234-5678-9012";
    const ct = encryptPII(pt);
    expect(ct).not.toBe(pt);
    expect(ct.split(".")).toHaveLength(3);
    expect(decryptPII(ct)).toBe(pt);
  });

  it("round-trips multibyte text", () => {
    const pt = "三井住友銀行・新宿支店・普通・1234567 / 田中花子";
    expect(decryptPII(encryptPII(pt))).toBe(pt);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const pt = "1234-5678-9012";
    const a = encryptPII(pt);
    const b = encryptPII(pt);
    expect(a).not.toBe(b);
  });

  it("rejects malformed input", () => {
    expect(() => decryptPII("not-encrypted")).toThrow();
    expect(() => decryptPII("aaa.bbb")).toThrow();
    expect(() => decryptPII("")).toThrow();
  });

  it("detects tampering (auth tag mismatch)", () => {
    const ct = encryptPII("secret");
    const parts = ct.split(".");
    // Flip last byte of the ciphertext segment
    const tamperedCt = parts[2].slice(0, -1) + (parts[2].endsWith("A") ? "B" : "A");
    const tampered = `${parts[0]}.${parts[1]}.${tamperedCt}`;
    expect(() => decryptPII(tampered)).toThrow();
  });

  it("rejects ciphertext with wrong IV length", () => {
    const broken = "AA.AAAAAAAAAAAAAAAAAAAA.AAAA";
    expect(() => decryptPII(broken)).toThrow();
  });
});

describe("maskPII", () => {
  it("hides all but last 4 chars by default", () => {
    expect(maskPII("1234567890")).toBe("••••••7890");
  });
  it("returns empty for empty input", () => {
    expect(maskPII("")).toBe("");
  });
});
