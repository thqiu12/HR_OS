"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "./db";
import { hasRole, canEditMaster, canEditMasterForSchool } from "./permissions";
import { logAudit } from "./audit";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

const VALID_UNITS = new Set(["hour", "class", "day", "fixed"]);
const VALID_SCOPES = new Set(["group", "entity", "school"]);

// ===== rate types (master) =====

export async function createWageRateTypeAction(input: {
  scopeType: string; scopeId: string | null; code: string; name: string;
  unit?: string; defaultAmount?: number | null; sortOrder?: number; notes?: string;
}) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!VALID_SCOPES.has(input.scopeType)) throw new AppError(400, "scopeType invalid");
  if (input.unit && !VALID_UNITS.has(input.unit)) throw new AppError(400, "unit invalid");
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(input.code)) {
    throw new AppError(400, "code は半角英数_ で 2〜31 文字 (英小文字始まり)");
  }
  if (!input.name.trim()) throw new AppError(400, "名称は必須");

  // Permissions:
  //  - group scope → group_admin only
  //  - entity scope → group_admin or entity_hr
  //  - school scope → group_admin / entity_hr / school_hr (for that school)
  if (input.scopeType === "group") {
    if (!hasRole(session, "group_admin")) throw new AppError(403, "Forbidden: group scope は group_admin のみ");
  } else if (input.scopeType === "entity") {
    if (!hasRole(session, "group_admin") && !hasRole(session, "entity_hr")) {
      throw new AppError(403, "Forbidden");
    }
  } else if (input.scopeType === "school") {
    if (!input.scopeId) throw new AppError(400, "school scope には scopeId が必要");
    if (!canEditMasterForSchool(session, input.scopeId)) throw new AppError(403, "Forbidden");
  }

  db.insertWageRateType({
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    code: input.code,
    name: input.name.trim(),
    unit: input.unit || "hour",
    defaultAmount: input.defaultAmount ?? null,
    sortOrder: input.sortOrder ?? 0,
    notes: input.notes ?? null,
  });
  await logAudit({ session, action: "wage_rate_type.create", after: input });
  revalidatePath("/settings/wage-types");
  return { ok: true as const };
}

export async function updateWageRateTypeAction(id: number, fields: Record<string, any>) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const t = db.wageRateType(id);
  if (!t) throw new AppError(404, "Not found");
  // For simplicity require group_admin or entity_hr to edit any type
  if (!hasRole(session, "group_admin") && !canEditMaster(session)) {
    throw new AppError(403, "Forbidden");
  }
  if ("unit" in fields && !VALID_UNITS.has(fields.unit)) throw new AppError(400, "unit invalid");
  db.updateWageRateType(id, fields);
  await logAudit({ session, action: "wage_rate_type.update", resourceType: "wage_rate_type", resourceId: String(id), after: fields });
  revalidatePath("/settings/wage-types");
  return { ok: true as const };
}

export async function deleteWageRateTypeAction(id: number) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!hasRole(session, "group_admin")) throw new AppError(403, "Forbidden: 削除は group_admin のみ");
  try {
    db.deleteWageRateType(id);
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "削除失敗" };
  }
  await logAudit({ session, action: "wage_rate_type.delete", resourceType: "wage_rate_type", resourceId: String(id) });
  revalidatePath("/settings/wage-types");
  return { ok: true as const };
}

// ===== employee wage rates =====

export async function addEmployeeWageRateAction(input: {
  employeeId: string; rateTypeId: number; amount: number;
  effectiveFrom: string; notes?: string;
}) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const e = db.employee(input.employeeId);
  if (!e) throw new AppError(404, "Employee not found");
  if (!canEditMasterForSchool(session, e.schoolId)) throw new AppError(403, "Forbidden");

  const t = db.wageRateType(input.rateTypeId);
  if (!t) throw new AppError(404, "賃率種別が見つかりません");

  if (!Number.isFinite(input.amount) || input.amount < 0 || input.amount > 1_000_000) {
    throw new AppError(400, "金額は 0〜1,000,000 円の整数で");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
    throw new AppError(400, "適用開始日は YYYY-MM-DD 形式で");
  }

  db.addEmployeeWageRate({
    employeeId: input.employeeId,
    rateTypeId: input.rateTypeId,
    amount: Math.floor(input.amount),
    effectiveFrom: input.effectiveFrom,
    notes: input.notes ?? null,
    createdBy: session.user.id,
  });
  await logAudit({
    session, action: "employee.wage.add",
    resourceType: "employee", resourceId: input.employeeId,
    after: { typeId: input.rateTypeId, typeCode: t.code, amount: input.amount, effectiveFrom: input.effectiveFrom },
  });
  revalidatePath(`/organization/employees/${input.employeeId}`);
  return { ok: true as const };
}

export async function endEmployeeWageRateAction(rateId: number, employeeId: string, effectiveTo: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const e = db.employee(employeeId);
  if (!e) throw new AppError(404, "Employee not found");
  if (!canEditMasterForSchool(session, e.schoolId)) throw new AppError(403, "Forbidden");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo)) {
    throw new AppError(400, "終了日は YYYY-MM-DD 形式で");
  }
  db.endEmployeeWageRate(rateId, effectiveTo);
  await logAudit({
    session, action: "employee.wage.end",
    resourceType: "employee", resourceId: employeeId,
    after: { rateId, effectiveTo },
  });
  revalidatePath(`/organization/employees/${employeeId}`);
  return { ok: true as const };
}
