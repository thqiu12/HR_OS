"use server";

import { auth } from "@/auth";
import { db } from "./db";
import { logAudit } from "./audit";
import bcrypt from "bcryptjs";

/**
 * Self-service password change for the currently logged-in user.
 *
 * Requires:
 *   - Valid session
 *   - Correct current password
 *   - New password ≥12 chars and different from current
 *
 * Anyone can call this for their OWN account — no admin role required.
 * Admins changing OTHER users' passwords use resetUserPasswordAction
 * in app/settings/users/actions.ts instead.
 */
export async function changeMyPasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "ログインしていません。再ログインしてください。" };
  }

  if (!input.currentPassword || !input.newPassword) {
    return { ok: false, error: "現在のパスワードと新しいパスワードを入力してください" };
  }
  if (input.newPassword.length < 12) {
    return { ok: false, error: "新しいパスワードは 12 文字以上で指定してください" };
  }
  if (input.currentPassword === input.newPassword) {
    return { ok: false, error: "新しいパスワードは現在のパスワードと異なる必要があります" };
  }

  const user: any = (db as any).userById(session.user.id);
  if (!user) {
    return { ok: false, error: "ユーザーが見つかりません(セッションが古い可能性があります)" };
  }

  const matches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!matches) {
    await logAudit({
      session,
      action: "password.change.denied",
      resourceType: "user",
      resourceId: user.id,
      reason: "wrong_current_password",
    });
    return { ok: false, error: "現在のパスワードが正しくありません" };
  }

  const newHash = await bcrypt.hash(input.newPassword, 12);
  (db as any).updateUserPassword(user.id, newHash);

  await logAudit({
    session,
    action: "password.change",
    resourceType: "user",
    resourceId: user.id,
  });

  return { ok: true };
}
