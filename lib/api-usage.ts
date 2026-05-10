import { db } from "./db";

/**
 * Anthropic API pricing — USD per 1M tokens. Keep in sync with platform.claude.com.
 * Cache write costs 1.25× input price (5m TTL); cache read costs 0.1× input price.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
  "claude-opus-4-6": { input: 5.0, output: 25.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

export function pricingFor(model: string): { input: number; output: number } {
  // Strip date suffix and try again if exact match misses
  const exact = PRICING[model];
  if (exact) return exact;
  const base = model.replace(/-\d{8}$/, "");
  return PRICING[base] || { input: 0, output: 0 };
}

export function estimateCost(opts: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}): number {
  const p = pricingFor(opts.model);
  const inputCost = (opts.inputTokens / 1_000_000) * p.input;
  const outputCost = (opts.outputTokens / 1_000_000) * p.output;
  const cacheWriteCost = ((opts.cacheCreationTokens || 0) / 1_000_000) * p.input * 1.25;
  const cacheReadCost = ((opts.cacheReadTokens || 0) / 1_000_000) * p.input * 0.1;
  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

export type ApiUsageEntry = {
  model: string;
  feature: string;
  userId?: string | null;
  userLogin?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  durationMs?: number;
  status: "success" | "error" | "mock";
  error?: string | null;
};

export function recordApiUsage(e: ApiUsageEntry) {
  const cost = estimateCost({
    model: e.model,
    inputTokens: e.inputTokens || 0,
    outputTokens: e.outputTokens || 0,
    cacheCreationTokens: e.cacheCreationTokens || 0,
    cacheReadTokens: e.cacheReadTokens || 0,
  });
  db.insertApiUsage({
    ts: new Date().toISOString(),
    model: e.model,
    feature: e.feature,
    userId: e.userId ?? null,
    userLogin: e.userLogin ?? null,
    resourceType: e.resourceType ?? null,
    resourceId: e.resourceId ?? null,
    inputTokens: e.inputTokens || 0,
    outputTokens: e.outputTokens || 0,
    cacheCreationTokens: e.cacheCreationTokens || 0,
    cacheReadTokens: e.cacheReadTokens || 0,
    costUsd: cost,
    durationMs: e.durationMs ?? null,
    status: e.status,
    error: e.error ?? null,
  });
  return cost;
}
