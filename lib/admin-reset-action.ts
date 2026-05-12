"use server";

import { db } from "./db";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

/**
 * Emergency password reset — designed for the first-login problem.
 *
 * Gated by ADMIN_RESET_TOKEN env var:
 *   - Unset → action refuses (the "off" state).
 *   - Set   → caller must provide the exact value as `token`.
 *
 * Browser-only operator workflow (no terminal needed):
 *   1. Fly.io dashboard → Secrets → add ADMIN_RESET_TOKEN=<your choice>.
 *      Fly auto-redeploys in ~30s.
 *   2. Visit https://<app>.fly.dev/admin-reset
 *   3. Enter loginId + new password + the token value you just set.
 *   4. After success, dashboard → Secrets → remove ADMIN_RESET_TOKEN to
 *      disable the endpoint.
 */
export async function resetAdminPasswordAction(input: {
  token: string;
  loginId: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const expected = process.env.ADMIN_RESET_TOKEN;
  if (!expected) {
    return {
      ok: false,
      error:
        "緊急リセットは無効です。Fly.io ダッシュボードの Secrets で ADMIN_RESET_TOKEN を設定してから再度お試しください。",
    };
  }

  // Constant-time token comparison
  const a = Buffer.from(input.token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "トークンが一致しません" };
  }

  if (input.newPassword.length < 12) {
    return { ok: false, error: "パスワードは 12 文字以上で指定してください" };
  }
  if (!input.loginId || input.loginId.length > 64) {
    return { ok: false, error: "ログインID が不正です" };
  }

  const user: any = (db as any).userByLogin(input.loginId);
  if (!user) {
    return {
      ok: false,
      error: `login_id="${input.loginId}" のユーザーが見つかりません`,
    };
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  (db as any).updateUserPassword(user.id, passwordHash);

  return { ok: true };
}
