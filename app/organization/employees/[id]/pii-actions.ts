"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { encryptPII, decryptPII, maskPII } from "@/lib/crypto";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

async function requireAdmin() {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!hasRole(session, "group_admin")) throw new AppError(403, "Forbidden");
  return session;
}

export async function setEmployeePiiAction(employeeId: string, fields: { myNumber?: string; bankAccount?: string; passportNo?: string }) {
  const session = await requireAdmin();
  const e = db.employee(employeeId);
  if (!e) throw new AppError(404, "Employee not found");

  const enc: any = {};
  if (fields.myNumber !== undefined) enc.myNumberEnc = fields.myNumber ? encryptPII(fields.myNumber) : null;
  if (fields.bankAccount !== undefined) enc.bankAccountEnc = fields.bankAccount ? encryptPII(fields.bankAccount) : null;
  if (fields.passportNo !== undefined) enc.passportNoEnc = fields.passportNo ? encryptPII(fields.passportNo) : null;

  db.setEmployeePii(employeeId, enc);

  await logAudit({
    session, action: "employee.pii.update",
    resourceType: "employee", resourceId: employeeId,
    after: {
      myNumber: fields.myNumber !== undefined ? (fields.myNumber ? "(set)" : "(cleared)") : "(unchanged)",
      bankAccount: fields.bankAccount !== undefined ? (fields.bankAccount ? "(set)" : "(cleared)") : "(unchanged)",
      passportNo: fields.passportNo !== undefined ? (fields.passportNo ? "(set)" : "(cleared)") : "(unchanged)",
    },
  });

  revalidatePath(`/organization/employees/${employeeId}`);
  return { ok: true as const };
}

/** Decrypt for display. Logs audit so PII access is traceable. */
export async function decryptEmployeePiiAction(employeeId: string, field: "myNumber" | "bankAccount" | "passportNo") {
  const session = await requireAdmin();
  const ct = db.getEmployeePiiCiphertext(employeeId);
  if (!ct) return { ok: false as const, error: "社員が見つかりません" };
  const map = { myNumber: ct.myNumberEnc, bankAccount: ct.bankAccountEnc, passportNo: ct.passportNoEnc };
  const enc = map[field];
  if (!enc) return { ok: false as const, error: "未設定" };

  let plaintext: string;
  try { plaintext = decryptPII(enc); }
  catch (e: any) {
    await logAudit({ session, action: "employee.pii.decrypt.failed", resourceType: "employee", resourceId: employeeId, reason: field });
    return { ok: false as const, error: "復号に失敗しました" };
  }

  await logAudit({
    session, action: "employee.pii.decrypt",
    resourceType: "employee", resourceId: employeeId,
    after: { field, masked: maskPII(plaintext) },
  });
  return { ok: true as const, plaintext, masked: maskPII(plaintext) };
}
