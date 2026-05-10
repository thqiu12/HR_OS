/**
 * Fail-fast environment validation for production.
 *
 * Call from a top-level boot path (e.g. layout.tsx server component) so missing
 * required vars surface as a clear startup error rather than a runtime crash
 * during the first request that needs them.
 */

type EnvSpec = { key: string; required: boolean; description: string; pattern?: RegExp };

const PROD_SPEC: EnvSpec[] = [
  {
    key: "AUTH_SECRET",
    required: true,
    description: "32-byte hex secret for NextAuth JWT signing. Generate with: openssl rand -hex 32",
    pattern: /^[0-9a-f]{32,}$/i,
  },
  {
    key: "ENCRYPTION_KEY",
    required: false, // falls back to AUTH_SECRET, but separation is recommended
    description: "Separate 32-byte hex key for PII encryption. Strongly recommended in prod for key rotation safety.",
    pattern: /^[0-9a-f]{32,}$/i,
  },
  {
    key: "AUTH_TRUST_HOST",
    required: true,
    description: "Set to 'true' when behind a proxy (Fly, Vercel, nginx). Required for OAuth callback URL resolution.",
  },
  {
    key: "CRON_SECRET",
    required: true,
    description: "Bearer token for /api/cron/* endpoints. Generate with: openssl rand -hex 32",
    pattern: /^[0-9a-f]{32,}$/i,
  },
];

export type EnvCheckResult = { ok: true } | { ok: false; errors: string[] };

export function checkEnv(): EnvCheckResult {
  if (process.env.NODE_ENV !== "production") return { ok: true };
  const errors: string[] = [];
  for (const s of PROD_SPEC) {
    const v = process.env[s.key];
    if (s.required && !v) {
      errors.push(`Missing required env: ${s.key} — ${s.description}`);
      continue;
    }
    if (v && s.pattern && !s.pattern.test(v)) {
      errors.push(`Invalid format for ${s.key} — expected pattern ${s.pattern}`);
    }
  }
  // ENCRYPTION_KEY warning when not set (allowed but recommended)
  if (!process.env.ENCRYPTION_KEY) {
    console.warn("[env-check] ENCRYPTION_KEY not set — using AUTH_SECRET for PII encryption. Set ENCRYPTION_KEY for production-grade key separation.");
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** Throws if production env is invalid. Call once from app boot. */
export function assertEnvOrExit(): void {
  const r = checkEnv();
  if (r.ok === true) return;
  console.error("=== PRODUCTION ENV VALIDATION FAILED ===");
  for (const err of r.errors) console.error("  - " + err);
  console.error("Refusing to start. Fix the env vars above.");
  process.exit(1);
}

// Auto-run on module load in production. This catches missing vars at import time
// rather than at first request (which might be a health check that hides the error).
if (process.env.NODE_ENV === "production") {
  assertEnvOrExit();
}
