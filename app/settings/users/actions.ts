"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

const VALID_ROLES = new Set(["group_admin", "entity_hr", "school_hr", "principal", "manager", "employee", "executive", "auditor"]);
const VALID_SCOPES = new Set(["group", "entity", "school", "department"]);

async function requireAdmin() {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!hasRole(session, "group_admin")) throw new AppError(403, "Forbidden");
  return session;
}

export async function createUserAction(input: {
  loginId: string; name: string; email: string; password: string;
  employeeId?: string;
  roles: { role: string; scopeType: string; scopeId: string | null }[];
}) {
  const session = await requireAdmin();
  if (!input.loginId?.trim()) throw new AppError(400, "ログインIDは必須です");
  if (!input.name?.trim()) throw new AppError(400, "氏名は必須です");
  if (!input.email?.includes("@")) throw new AppError(400, "メールアドレスが不正です");
  if ((input.password || "").length < 8) throw new AppError(400, "パスワードは8文字以上必要です");
  if (!Array.isArray(input.roles) || input.roles.length === 0) throw new AppError(400, "ロールを最低1つ指定してください");

  // Check duplicates
  if (db.userByLogin(input.loginId)) throw new AppError(409, "そのログインIDは既に使用されています");

  for (const r of input.roles) {
    if (!VALID_ROLES.has(r.role)) throw new AppError(400, `Unknown role: ${r.role}`);
    if (!VALID_SCOPES.has(r.scopeType)) throw new AppError(400, `Unknown scope: ${r.scopeType}`);
  }

  const id = `u_${randomBytes(5).toString("hex")}`;
  const hash = await bcrypt.hash(input.password, 10);
  db.insertUser({
    id, loginId: input.loginId.trim(), name: input.name.trim(), email: input.email.trim(),
    passwordHash: hash, employeeId: input.employeeId?.trim() || null,
  });
  for (const r of input.roles) {
    db.insertUserRole({ userId: id, role: r.role, scopeType: r.scopeType, scopeId: r.scopeId });
  }

  await logAudit({
    session, action: "user.create",
    resourceType: "user", resourceId: id,
    after: { loginId: input.loginId, name: input.name, roles: input.roles },
  });
  revalidatePath("/settings/users");
  return { ok: true as const, id };
}

export async function updateUserRolesAction(userId: string, roles: { role: string; scopeType: string; scopeId: string | null }[]) {
  const session = await requireAdmin();
  if (userId === session.user.id) throw new AppError(400, "自分自身のロールは編集できません");
  const u = db.userById(userId);
  if (!u) throw new AppError(404, "User not found");
  for (const r of roles) {
    if (!VALID_ROLES.has(r.role)) throw new AppError(400, `Unknown role: ${r.role}`);
    if (!VALID_SCOPES.has(r.scopeType)) throw new AppError(400, `Unknown scope: ${r.scopeType}`);
  }
  const before = db.rolesByUserId(userId);
  db.deleteUserRolesByUser(userId);
  for (const r of roles) db.insertUserRole({ userId, role: r.role, scopeType: r.scopeType, scopeId: r.scopeId });
  await logAudit({
    session, action: "user.roles.update",
    resourceType: "user", resourceId: userId,
    before: { roles: before }, after: { roles },
  });
  revalidatePath("/settings/users");
  return { ok: true as const };
}

export async function deleteUserAction(userId: string) {
  const session = await requireAdmin();
  if (userId === session.user.id) throw new AppError(400, "自分自身は削除できません");
  const u = db.userById(userId);
  if (!u) throw new AppError(404, "User not found");
  db.deleteUserById(userId);
  await logAudit({
    session, action: "user.delete",
    resourceType: "user", resourceId: userId,
    before: { loginId: u.loginId, name: u.name },
  });
  revalidatePath("/settings/users");
  return { ok: true as const };
}

export async function resetUserPasswordAction(userId: string, newPassword: string) {
  const session = await requireAdmin();
  if ((newPassword || "").length < 8) throw new AppError(400, "8文字以上必要です");
  const u = db.userById(userId);
  if (!u) throw new AppError(404, "User not found");
  const hash = await bcrypt.hash(newPassword, 10);
  db.updateUserPassword(userId, hash);
  await logAudit({
    session, action: "user.password.reset",
    resourceType: "user", resourceId: userId,
  });
  return { ok: true as const };
}

/** Admin: revoke all active sessions for a user (force re-login). */
export async function revokeUserSessionsAction(userId: string, reason?: string) {
  const session = await requireAdmin();
  const u = db.userById(userId);
  if (!u) throw new AppError(404, "User not found");
  db.revokeUserSessions(userId, session.user.id, reason);
  await logAudit({
    session, action: "user.sessions.revoke",
    resourceType: "user", resourceId: userId,
    reason,
  });
  return { ok: true as const };
}
