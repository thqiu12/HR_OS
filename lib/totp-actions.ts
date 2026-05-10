"use server";
import { auth } from "@/auth";
import { db } from "./db";
import { logAudit } from "./audit";
import { generateTotpSecret, totpProvisionUri, verifyTotp } from "./totp";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

/** Step 1: generate a fresh secret for this user. Returns secret + provisioning URI for QR display. */
export async function start2faSetupAction() {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const secret = generateTotpSecret();
  const uri = totpProvisionUri({
    secret,
    account: session.user.loginId,
    issuer: "HR OS",
  });
  // Don't persist yet — only persist after user proves they can compute a valid code
  return { secret, uri };
}

/** Step 2: persist the secret after the user enters a valid code from their authenticator. */
export async function confirm2faSetupAction(secret: string, code: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!verifyTotp(secret, code)) {
    return { ok: false as const, error: "コードが一致しません。Authenticator アプリで再表示して再入力してください。" };
  }
  db.setUserTotp(session.user.id, secret);
  await logAudit({ session, action: "auth.2fa.enabled" });
  return { ok: true as const };
}

/** Disable 2FA for the current user. Requires a valid current code (proof of possession). */
export async function disable2faAction(code: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const u = db.userById(session.user.id);
  if (!u?.totpSecret) return { ok: true as const, alreadyDisabled: true };
  if (!verifyTotp(u.totpSecret, code)) {
    return { ok: false as const, error: "コードが一致しません。" };
  }
  db.setUserTotp(session.user.id, null);
  await logAudit({ session, action: "auth.2fa.disabled" });
  return { ok: true as const };
}
