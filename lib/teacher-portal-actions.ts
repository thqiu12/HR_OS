"use server";
import { auth } from "@/auth";
import { db } from "./db";
import { canEditMasterForSchool, canViewEmployee } from "./permissions";
import { logAudit } from "./audit";
import { issueTeacherPortalToken } from "./invite-token";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

/**
 * Issue a no-login portal URL for a teacher to view their own shifts + payslips.
 * Returns the full URL the HR sends to the teacher (via email or copy-paste).
 */
export async function issueTeacherPortalUrlAction(employeeId: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const e = db.employee(employeeId);
  if (!e) throw new AppError(404, "Employee not found");
  if (!canEditMasterForSchool(session, e.schoolId)) throw new AppError(403, "Forbidden");

  const token = await issueTeacherPortalToken({ employeeId, issuedBy: session.user.id, days: 90 });
  const base = process.env.APP_BASE_URL || "http://localhost:3010";
  const url = `${base}/portal/teacher/${token}`;

  await logAudit({
    session, action: "teacher.portal.invite",
    resourceType: "employee", resourceId: employeeId,
    after: { expiresInDays: 90 },
  });
  return { ok: true as const, url };
}
