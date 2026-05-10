import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { inviteVerifyRateLimit } from "./rate-limit";

const ISSUER = "hr-os";
const AUDIENCE = "onboarding-portal";
const DEFAULT_DAYS = 30;

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export type InviteClaims = {
  caseId: string;
  jti: string;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
};

/**
 * Issue a signed onboarding-invite token. Persists a row in invite_tokens for
 * later revocation lookup. Returns the JWT string.
 */
export async function issueInviteToken(opts: {
  caseId: string;
  issuedBy?: string | null;
  days?: number;
}): Promise<string> {
  const { caseId, issuedBy = null, days = DEFAULT_DAYS } = opts;
  const jti = randomBytes(12).toString("hex");
  const now = Math.floor(Date.now() / 1000);
  const exp = now + days * 86400;

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(caseId)
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getSecret());

  db.insertInviteToken({
    jti,
    caseId,
    issuedBy,
    issuedAt: new Date(now * 1000).toISOString(),
    expiresAt: new Date(exp * 1000).toISOString(),
  });

  return token;
}

export type InviteVerifyResult =
  | { ok: true; caseId: string; jti: string; expiresAt: string }
  | { ok: false; reason: "invalid_signature" | "expired" | "wrong_audience" | "wrong_issuer" | "revoked" | "unknown_jti" | "rate_limited" };

function clientIp(): string {
  try {
    const h = headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Verify an invite token. Checks signature, expiry, audience/issuer, and that
 * the jti exists in invite_tokens and is not revoked.
 */
export async function verifyInviteToken(token: string): Promise<InviteVerifyResult> {
  // Rate limit by client IP to mitigate token-guessing attacks
  const ip = clientIp();
  if (ip !== "unknown") {
    const rl = inviteVerifyRateLimit(ip);
    if (!rl.allowed) return { ok: false, reason: "rate_limited" };
  }
  let payload: any;
  try {
    const result = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    payload = result.payload;
  } catch (e: any) {
    const code = e?.code || "";
    if (code === "ERR_JWT_EXPIRED") return { ok: false, reason: "expired" };
    if (code === "ERR_JWT_CLAIM_VALIDATION_FAILED") {
      const claim = (e?.claim || "").toLowerCase();
      if (claim === "iss") return { ok: false, reason: "wrong_issuer" };
      if (claim === "aud") return { ok: false, reason: "wrong_audience" };
    }
    return { ok: false, reason: "invalid_signature" };
  }

  const jti = payload.jti as string | undefined;
  const caseId = payload.sub as string | undefined;
  if (!jti || !caseId) return { ok: false, reason: "invalid_signature" };

  const row = db.inviteTokenByJti(jti);
  if (!row) return { ok: false, reason: "unknown_jti" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.caseId !== caseId) return { ok: false, reason: "invalid_signature" };

  return { ok: true, caseId, jti, expiresAt: row.expiresAt };
}

export function touchInvite(jti: string) {
  db.touchInviteToken(jti);
}

export function revokeInvite(jti: string) {
  db.revokeInviteToken(jti);
}
