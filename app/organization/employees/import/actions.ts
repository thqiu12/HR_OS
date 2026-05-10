"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canEditMaster, hasRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { csvToObjects } from "@/lib/csv";
import { randomBytes } from "crypto";

const FLAGS: Record<string, string> = {
  "日本": "🇯🇵", "中国": "🇨🇳", "ベトナム": "🇻🇳", "ネパール": "🇳🇵", "韓国": "🇰🇷",
};
const REQUIRED = ["empNo", "name", "kana", "schoolId", "departmentId", "position", "hireRoute", "hireDate", "probationEnd"];

export type EmployeeImportRow = {
  rowIndex: number;
  raw: Record<string, string>;
  ok: boolean;
  errors: string[];
};

export async function previewEmployeeCsv(text: string): Promise<{ headers: string[]; rows: EmployeeImportRow[]; ok: number; ng: number }> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (!canEditMaster(session) && !hasRole(session, "school_hr")) throw new Error("Forbidden");

  const objs = csvToObjects(text);
  const schools = db.schools() as any[];
  const departments = db.departments() as any[];
  const headers = Object.keys(objs[0] || {});

  const rows: EmployeeImportRow[] = objs.map((r, i) => {
    const errors: string[] = [];
    for (const field of REQUIRED) {
      if (!r[field]) errors.push(`${field}: 必須`);
    }
    if (r.schoolId && !schools.some((s) => s.id === r.schoolId)) errors.push(`schoolId: ${r.schoolId} は存在しません`);
    if (r.departmentId && !departments.some((d) => d.id === r.departmentId)) errors.push(`departmentId: ${r.departmentId} は存在しません`);
    if (r.hireRoute && !["新卒", "中途"].includes(r.hireRoute)) errors.push(`hireRoute: 新卒 or 中途`);
    if (r.hireDate && !/^\d{4}-\d{2}-\d{2}$/.test(r.hireDate)) errors.push(`hireDate: YYYY-MM-DD`);
    if (r.probationEnd && !/^\d{4}-\d{2}-\d{2}$/.test(r.probationEnd)) errors.push(`probationEnd: YYYY-MM-DD`);
    return { rowIndex: i + 2, raw: r, ok: errors.length === 0, errors };
  });
  return { headers, rows, ok: rows.filter((r) => r.ok).length, ng: rows.filter((r) => !r.ok).length };
}

export async function commitEmployeeImport(text: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (!canEditMaster(session) && !hasRole(session, "school_hr")) throw new Error("Forbidden");

  const preview = await previewEmployeeCsv(text);
  const validRows = preview.rows.filter((r) => r.ok);
  let inserted = 0;
  for (const row of validRows) {
    const r = row.raw;
    const id = `emp_${randomBytes(5).toString("hex")}`;
    const nationality = r.nationality || "日本";
    db.insertEmployee({
      id, empNo: r.empNo, name: r.name, kana: r.kana, romaji: r.romaji || r.name,
      nationality, flag: FLAGS[nationality] || "🏳",
      email: r.email || `${r.empNo.toLowerCase()}@example.com`,
      schoolId: r.schoolId, departmentId: r.departmentId, position: r.position,
      hireRoute: r.hireRoute, hireDate: r.hireDate, probationEnd: r.probationEnd,
      contractEnd: r.contractEnd || null, zairyuExpiry: r.zairyuExpiry || null,
      status: r.status || "試用期間",
      isPrimary: true, costRatio: 100, assignmentType: "所属",
    });
    // Also create the corresponding employee_assignments row (if table exists)
    try {
      db.insertAssignment({
        id: `asg_${randomBytes(5).toString("hex")}`,
        employeeId: id, schoolId: r.schoolId, departmentId: r.departmentId, position: r.position,
        isPrimary: true, assignmentType: "所属", costRatio: 100,
        managerEmployeeId: null, evaluatorEmployeeId: null,
        startDate: r.hireDate,
      });
    } catch {}
    inserted++;
  }
  await logAudit({
    session, action: "employee.csv_import",
    after: { inserted, skipped: preview.ng, total: preview.rows.length },
  });
  revalidatePath("/organization/employees");
  revalidatePath("/organization/tree");
  return { ok: true as const, inserted, skipped: preview.ng };
}
