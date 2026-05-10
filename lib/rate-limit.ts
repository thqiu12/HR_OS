import { db } from "./db";

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; resetAt: number; retryAfter: number };

/**
 * Sliding-window rate limit backed by SQLite. Aligned to fixed windows of
 * `windowSec` seconds. Suitable for login throttling, invite verification, etc.
 *
 * @param key      stable identifier (e.g. `login:tanaka@1.2.3.4`)
 * @param max      max hits allowed in the window
 * @param windowSec window duration in seconds
 */
export function checkRateLimit(key: string, max: number, windowSec: number): RateLimitResult {
  const { count, windowStart } = db.rateLimitHit(key, windowSec);
  const resetAt = (windowStart + windowSec) * 1000;
  if (count > max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
    };
  }
  return { allowed: true, remaining: Math.max(0, max - count), resetAt };
}

/** Convenience: per-IP+identity login throttle (5/min). Stops password guessing for one account. */
export function loginRateLimit(ip: string, loginId: string): RateLimitResult {
  return checkRateLimit(`login:${ip}:${loginId}`, 5, 60);
}

/** Convenience: per-IP-only login throttle (30/min). Stops credential stuffing across many accounts. */
export function loginIpRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`login-ip:${ip}`, 30, 60);
}

/** Convenience: per-IP invite verify throttle (anti-token-guessing). */
export function inviteVerifyRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`invite:${ip}`, 30, 60);
}

/** Best-effort cleanup; safe to call from any cron-like scheduler. */
export function pruneOldRateLimits() {
  db.rateLimitCleanup(3600);
}
