import { describe, it, expect, beforeAll } from "vitest";
import { issueInviteToken, verifyInviteToken, revokeInvite } from "@/lib/invite-token";
import { db } from "@/lib/db";
import { SignJWT } from "jose";

beforeAll(() => {
  // touch DB to make sure seed has run before any test
  db.schools();
});

describe("issueInviteToken", () => {
  it("creates a token tied to a real case", async () => {
    const t = await issueInviteToken({ caseId: "o1" });
    const r = await verifyInviteToken(t);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.caseId).toBe("o1");
      expect(r.jti).toBeTruthy();
    }
  });

  it("inserts a row in invite_tokens", async () => {
    const t = await issueInviteToken({ caseId: "o2", issuedBy: "u1" });
    const r = await verifyInviteToken(t);
    if (r.ok) {
      const row = db.inviteTokenByJti(r.jti);
      expect(row).not.toBeNull();
      expect(row?.caseId).toBe("o2");
      expect(row?.issuedBy).toBe("u1");
      expect(row?.revokedAt).toBeNull();
    }
  });
});

describe("verifyInviteToken security", () => {
  it("rejects a tampered token (signature mismatch)", async () => {
    const t = await issueInviteToken({ caseId: "o1" });
    // Flip a character in the payload (middle segment)
    const parts = t.split(".");
    const tampered = `${parts[0]}.${parts[1].slice(0, -2)}AB.${parts[2]}`;
    const r = await verifyInviteToken(tampered);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(["invalid_signature", "expired"]).toContain(r.reason);
  });

  it("rejects a token signed with a different secret", async () => {
    const wrongKey = new TextEncoder().encode("nope-".repeat(20));
    const bad = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("hr-os")
      .setAudience("onboarding-portal")
      .setSubject("o1")
      .setJti("forged")
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(wrongKey);
    const r = await verifyInviteToken(bad);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toBe("invalid_signature");
  });

  it("rejects a token with wrong audience", async () => {
    const key = new TextEncoder().encode(process.env.AUTH_SECRET!);
    const bad = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("hr-os")
      .setAudience("some-other-audience")
      .setSubject("o1")
      .setJti("aud-test")
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(key);
    const r = await verifyInviteToken(bad);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(["wrong_audience", "invalid_signature"]).toContain(r.reason);
  });

  it("rejects expired tokens", async () => {
    const key = new TextEncoder().encode(process.env.AUTH_SECRET!);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("hr-os")
      .setAudience("onboarding-portal")
      .setSubject("o1")
      .setJti("expired-test")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 86400 * 60)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 86400)
      .sign(key);
    const r = await verifyInviteToken(expired);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toBe("expired");
  });

  it("rejects a token whose jti is not in invite_tokens (forged but valid sig)", async () => {
    const key = new TextEncoder().encode(process.env.AUTH_SECRET!);
    const orphan = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("hr-os")
      .setAudience("onboarding-portal")
      .setSubject("o1")
      .setJti("not-issued-via-our-api")
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(key);
    const r = await verifyInviteToken(orphan);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toBe("unknown_jti");
  });

  it("revoked token is rejected even if signature & expiry are valid", async () => {
    const t = await issueInviteToken({ caseId: "o3" });
    const r1 = await verifyInviteToken(t);
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      revokeInvite(r1.jti);
      const r2 = await verifyInviteToken(t);
      expect(r2.ok).toBe(false);
      if (r2.ok === false) expect(r2.reason).toBe("revoked");
    }
  });

  it("garbage input fails cleanly", async () => {
    const r = await verifyInviteToken("not-a-jwt-at-all");
    expect(r.ok).toBe(false);
  });
});
