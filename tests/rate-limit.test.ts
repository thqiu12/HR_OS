import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";
import { randomBytes } from "crypto";

const newKey = () => `test:${randomBytes(8).toString("hex")}`;

describe("checkRateLimit", () => {
  it("allows up to max hits, then blocks", () => {
    const key = newKey();
    // 3 allowed, 4th blocked
    expect(checkRateLimit(key, 3, 60).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60).allowed).toBe(true);
    const r4 = checkRateLimit(key, 3, 60);
    expect(r4.allowed).toBe(false);
    if (r4.allowed === false) {
      expect(r4.retryAfter).toBeGreaterThan(0);
      expect(r4.retryAfter).toBeLessThanOrEqual(60);
    }
  });

  it("counts independently across keys", () => {
    const a = newKey();
    const b = newKey();
    for (let i = 0; i < 5; i++) checkRateLimit(a, 5, 60);
    expect(checkRateLimit(a, 5, 60).allowed).toBe(false);
    // b is fresh
    expect(checkRateLimit(b, 5, 60).allowed).toBe(true);
  });

  it("returns remaining count correctly", () => {
    const key = newKey();
    const r1 = checkRateLimit(key, 5, 60);
    if (r1.allowed) expect(r1.remaining).toBe(4);
    const r2 = checkRateLimit(key, 5, 60);
    if (r2.allowed) expect(r2.remaining).toBe(3);
  });
});
