import { describe, it, expect } from "vitest";
import { estimateCost, pricingFor, recordApiUsage } from "@/lib/api-usage";
import { db } from "@/lib/db";

describe("api-usage cost estimation", () => {
  it("returns canonical pricing for known models", () => {
    expect(pricingFor("claude-opus-4-7")).toEqual({ input: 5, output: 25 });
    expect(pricingFor("claude-sonnet-4-6")).toEqual({ input: 3, output: 15 });
    expect(pricingFor("claude-haiku-4-5")).toEqual({ input: 1, output: 5 });
  });

  it("falls back to base model when date suffix is present", () => {
    expect(pricingFor("claude-opus-4-7-20260301")).toEqual({ input: 5, output: 25 });
  });

  it("returns zero pricing for unknown models", () => {
    expect(pricingFor("gpt-4")).toEqual({ input: 0, output: 0 });
    expect(estimateCost({ model: "unknown", inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(0);
  });

  it("computes cost accurately including cache", () => {
    // 1M input on opus-4-7 = $5; 1M output = $25; cache write = 1.25x; cache read = 0.1x
    const cost = estimateCost({
      model: "claude-opus-4-7",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheCreationTokens: 1_000_000,    // 1.25x = $6.25
      cacheReadTokens: 1_000_000,        // 0.1x = $0.50
    });
    expect(cost).toBeCloseTo(5 + 25 + 6.25 + 0.5, 4);
  });
});

describe("recordApiUsage", () => {
  it("inserts a row with computed cost", () => {
    recordApiUsage({
      model: "claude-sonnet-4-6",
      feature: "test",
      status: "success",
      inputTokens: 10_000,
      outputTokens: 2_000,
      durationMs: 1234,
    });
    const since = new Date(Date.now() - 60_000).toISOString();
    const rows: any[] = db.apiUsageSince(since);
    const last = rows.find((r) => r.feature === "test");
    expect(last).toBeTruthy();
    // 10K input on sonnet @ $3/1M = $0.03; 2K output @ $15/1M = $0.03
    expect(last.costUsd).toBeCloseTo(0.03 + 0.03, 4);
  });
});
