"use server";
import { auth } from "@/auth";
import { db } from "./db";
import { hasRole } from "./permissions";
import { logAudit } from "./audit";
import { decryptPII } from "./crypto";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

async function requireAdmin() {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!hasRole(session, "group_admin")) throw new AppError(403, "Forbidden");
  return session;
}

/**
 * Right of access (個人情報開示請求): export every record about an employee in
 * machine-readable JSON. Used to comply with subject access requests under
 * 個人情報保護法 / GDPR-style regulations.
 */
export async function exportEmployeeDataAction(employeeId: string) {
  const session = await requireAdmin();
  const e: any = db.employee(employeeId);
  if (!e) throw new AppError(404, "Employee not found");

  const ct = db.getEmployeePiiCiphertext(employeeId);
  const piiPlain = ct
    ? {
        myNumber: ct.myNumberEnc ? safeDecrypt(ct.myNumberEnc) : null,
        bankAccount: ct.bankAccountEnc ? safeDecrypt(ct.bankAccountEnc) : null,
        passportNo: ct.passportNoEnc ? safeDecrypt(ct.passportNoEnc) : null,
      }
    : null;

  const assignments: any[] = (db as any).assignmentsByEmployee?.(employeeId) ?? [];
  const reviews: any[] = (db as any).reviewsByEmployee?.(employeeId) ?? [];

  const audit = (db as any)
    .recentAuditLogs?.(10000)
    ?.filter((a: any) => a.resourceType === "employee" && a.resourceId === employeeId) ?? [];

  await logAudit({
    session,
    action: "subject_access.export",
    resourceType: "employee",
    resourceId: employeeId,
  });

  return {
    exportedAt: new Date().toISOString(),
    employee: e,
    pii: piiPlain,
    assignments,
    reviews,
    auditTrail: audit,
  };
}

/**
 * Right to erasure (削除請求 / 忘れられる権利): mark an employee for soft delete
 * immediately and schedule hard delete after the legal retention window.
 *
 * For hard delete (post-retention), use the runRetention cron path.
 */
export async function softDeleteEmployeeAction(employeeId: string, reason: string) {
  const session = await requireAdmin();
  const e: any = db.employee(employeeId);
  if (!e) throw new AppError(404, "Employee not found");
  if (e.status === "退職") return { ok: true as const, alreadyResigned: true };

  // Mark as resigned with today's date — the retention cron will purge PII after policy window.
  db.updateEmployee(employeeId, { status: "退職", contractEnd: new Date().toISOString().slice(0, 10) });

  // Immediate PII clearing (irreversible) for explicit erasure requests
  db.setEmployeePii(employeeId, {
    myNumberEnc: null,
    bankAccountEnc: null,
    passportNoEnc: null,
  });

  // Revoke any active sessions for the user(s) linked to this employee
  const allUsers = (db as any).allUsers?.() ?? [];
  for (const u of allUsers) {
    if (u.employeeId === employeeId) {
      db.revokeUserSessions(u.id, session.user.id, `subject_erasure: ${reason}`);
    }
  }

  await logAudit({
    session,
    action: "subject_access.erasure",
    resourceType: "employee",
    resourceId: employeeId,
    reason,
    after: { status: "退職", piiCleared: true },
  });

  return { ok: true as const };
}

function safeDecrypt(enc: string): string {
  try {
    return decryptPII(enc);
  } catch {
    return "(decryption failed)";
  }
}
