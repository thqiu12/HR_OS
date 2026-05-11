"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "./db";
import { canEditMasterForSchool, canEditMaster } from "./permissions";
import { logAudit } from "./audit";
import { randomBytes } from "crypto";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

async function requireSession() {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  return session;
}

const newId = (prefix: string) => `${prefix}_${randomBytes(5).toString("hex")}`;

// ===== Employees =====
export async function createEmployeeAction(input: {
  empNo: string; name: string; kana: string; romaji: string;
  nationality: string; flag: string; email: string;
  schoolId: string; departmentId: string; position: string;
  hireRoute: "新卒" | "中途"; hireDate: string; probationEnd: string;
  zairyuExpiry?: string; contractEnd?: string;
  managerId?: string; evaluatorId?: string;
}) {
  const session = await requireSession();
  if (!canEditMasterForSchool(session, input.schoolId)) {
    await logAudit({ session, action: "employee.create.denied", reason: "scope" });
    throw new AppError(403, "Forbidden");
  }
  if (!input.name || !input.empNo || !input.schoolId || !input.departmentId) {
    throw new AppError(400, "必須項目が不足しています");
  }
  const id = newId("emp");
  db.insertEmployee({
    id, ...input,
    status: "試用期間",
    isPrimary: true, costRatio: 100, assignmentType: "所属",
  });
  await logAudit({
    session, action: "employee.create",
    resourceType: "employee", resourceId: id,
    after: { empNo: input.empNo, name: input.name, schoolId: input.schoolId },
  });
  revalidatePath("/organization/tree");
  revalidatePath("/organization/employees");
  revalidatePath("/dashboard");
  return { ok: true as const, id };
}

export async function updateEmployeeAction(id: string, fields: Record<string, any>) {
  const session = await requireSession();
  const e = db.employee(id);
  if (!e) throw new AppError(404, "Employee not found");
  if (!canEditMasterForSchool(session, e.schoolId)) {
    await logAudit({ session, action: "employee.update.denied", resourceType: "employee", resourceId: id, reason: "scope" });
    throw new AppError(403, "Forbidden");
  }
  // Validation for new wage / employment_type fields
  if ("employmentType" in fields && fields.employmentType != null) {
    if (!["regular", "contract", "part_time", "gyomu_itaku"].includes(fields.employmentType)) {
      throw new AppError(400, `Invalid employmentType: ${fields.employmentType}`);
    }
  }
  for (const k of ["hourlyRate", "perClassRate"] as const) {
    if (k in fields && fields[k] != null) {
      const n = Number(fields[k]);
      if (!Number.isFinite(n) || n < 0 || n > 100000) {
        throw new AppError(400, `${k} は 0〜100000 の範囲で指定してください`);
      }
      fields[k] = Math.floor(n);
    }
  }
  if ("commuteMode" in fields && fields.commuteMode != null) {
    if (!["none", "commute_pass", "per_diem", "per_shift"].includes(fields.commuteMode)) {
      throw new AppError(400, `Invalid commuteMode: ${fields.commuteMode}`);
    }
  }
  if ("commuteAmount" in fields && fields.commuteAmount != null) {
    const n = Number(fields.commuteAmount);
    if (!Number.isFinite(n) || n < 0 || n > 200000) {
      throw new AppError(400, "通勤手当は 0〜200000 円の範囲で指定してください");
    }
    fields.commuteAmount = Math.floor(n);
  }
  const before = { ...e };
  db.updateEmployee(id, fields);
  await logAudit({
    session, action: "employee.update",
    resourceType: "employee", resourceId: id,
    before, after: fields,
  });
  revalidatePath(`/organization/employees/${id}`);
  revalidatePath("/organization/tree");
  return { ok: true as const };
}

// ===== Jobs =====
export async function createJobAction(input: {
  title: string; schoolId: string; departmentId: string;
  route: "新卒" | "中途"; status: "公開中" | "下書き" | "停止"; openCount: number;
}) {
  const session = await requireSession();
  if (!canEditMasterForSchool(session, input.schoolId)) {
    await logAudit({ session, action: "job.create.denied", reason: "scope" });
    throw new AppError(403, "Forbidden");
  }
  if (!input.title) throw new AppError(400, "タイトルは必須です");
  const id = newId("job");
  db.insertJob({ id, ...input, postedAt: new Date().toISOString().slice(0, 10) });
  await logAudit({
    session, action: "job.create",
    resourceType: "job", resourceId: id,
    after: { title: input.title, schoolId: input.schoolId },
  });
  revalidatePath("/recruiting/pipeline");
  revalidatePath("/recruiting/jobs");
  revalidatePath("/dashboard");
  return { ok: true as const, id };
}

// ===== Schools =====
const SCHOOL_TYPES = new Set(["jls", "senmon", "juku", "hq", "university", "school", "other"]);
export async function createSchoolAction(input: { name: string; type: string; entity: string }) {
  const session = await requireSession();
  if (!canEditMaster(session)) throw new AppError(403, "Forbidden");
  if (!input.name?.trim() || !input.entity?.trim()) throw new AppError(400, "学校名と法人名は必須です");
  const t = (input.type || "school").toLowerCase();
  if (!SCHOOL_TYPES.has(t)) throw new AppError(400, "type は jls/senmon/juku/hq/university/school/other");
  const id = newId("sch");
  db.insertSchool({ id, name: input.name.trim(), type: t, entity: input.entity.trim() });
  await logAudit({ session, action: "school.create", resourceType: "school", resourceId: id, after: input });
  revalidatePath("/organization/schools");
  revalidatePath("/organization/tree");
  return { ok: true as const, id };
}

export async function updateSchoolAction(id: string, fields: { name?: string; type?: string; entity?: string }) {
  const session = await requireSession();
  if (!canEditMaster(session)) throw new AppError(403, "Forbidden");
  const before = db.schoolById(id);
  if (!before) throw new AppError(404, "Not found");
  if (fields.type && !SCHOOL_TYPES.has(fields.type)) throw new AppError(400, "type は jls/senmon/juku/hq/university/school/other");
  db.updateSchool(id, fields);
  await logAudit({ session, action: "school.update", resourceType: "school", resourceId: id, before, after: fields });
  revalidatePath("/organization/schools");
  revalidatePath("/organization/tree");
  return { ok: true as const };
}

export async function deleteSchoolAction(id: string) {
  const session = await requireSession();
  if (!canEditMaster(session)) throw new AppError(403, "Forbidden");
  try { db.deleteSchool(id); }
  catch (e: any) { return { ok: false as const, error: e?.message || "削除に失敗" }; }
  await logAudit({ session, action: "school.delete", resourceType: "school", resourceId: id });
  revalidatePath("/organization/schools");
  revalidatePath("/organization/tree");
  return { ok: true as const };
}

// ===== Departments =====
export async function createDepartmentAction(input: { schoolId: string; name: string }) {
  const session = await requireSession();
  if (!canEditMasterForSchool(session, input.schoolId)) {
    await logAudit({ session, action: "department.create.denied", reason: "scope" });
    throw new AppError(403, "Forbidden");
  }
  if (!input.name?.trim()) throw new AppError(400, "部門名は必須です");
  const id = newId("dept");
  db.insertDepartment({ id, schoolId: input.schoolId, name: input.name.trim() });
  await logAudit({ session, action: "department.create", resourceType: "department", resourceId: id, after: input });
  revalidatePath("/organization/tree");
  return { ok: true as const, id };
}

export async function renameDepartmentAction(id: string, name: string) {
  const session = await requireSession();
  if (!canEditMaster(session)) throw new AppError(403, "Forbidden");
  if (!name.trim()) throw new AppError(400, "部門名は必須です");
  db.updateDepartment(id, name.trim());
  await logAudit({ session, action: "department.rename", resourceType: "department", resourceId: id, after: { name } });
  revalidatePath("/organization/tree");
  revalidatePath("/organization/departments");
  return { ok: true as const };
}

export async function deleteDepartmentAction(id: string) {
  const session = await requireSession();
  if (!canEditMaster(session)) throw new AppError(403, "Forbidden");
  try {
    db.deleteDepartment(id);
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "削除に失敗しました" };
  }
  await logAudit({ session, action: "department.delete", resourceType: "department", resourceId: id });
  revalidatePath("/organization/tree");
  revalidatePath("/organization/departments");
  return { ok: true as const };
}
