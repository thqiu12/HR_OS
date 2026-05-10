import { describe, it, expect, vi, beforeEach } from "vitest";
import { withSentry, captureError } from "@/lib/sentry";

describe("Sentry wrapper (no-op when DSN missing)", () => {
  beforeEach(() => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it("withSentry passes through return values", async () => {
    const wrapped = withSentry("test", async (a: number, b: number) => a + b);
    expect(await wrapped(2, 3)).toBe(5);
  });

  it("withSentry rethrows errors", async () => {
    const wrapped = withSentry("boom", async () => {
      throw new Error("test failure");
    });
    await expect(wrapped()).rejects.toThrow("test failure");
  });

  it("captureError no-ops gracefully when no DSN configured", async () => {
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    await captureError(new Error("x"), { foo: "bar" });
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });
});
