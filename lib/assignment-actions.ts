"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "./db";
import { canEditMasterForSchool } from "./permissions";
import { logAudit } from "./audit";
import { randomBytes } from "crypto";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

export async function addAssignmentAction(input: {
  employeeId: string;
  schoolId: string;
  departmentId: string;
  position: string;
  assignmentType: "兼任" | "出向";
  costRatio: number;
  managerEmployeeId?: string;
  startDate: string;
  endDate?: string;
}) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const emp = db.employee(input.employeeId);
  if (!emp) throw new AppError(404, "Employee not found");
  // Caller must be able to edit BOTH the employee's primary school and the new assignment's school
  if (!canEditMasterForSchool(session, emp.schoolId)) throw new AppError(403, "Forbidden (origin school)");
  if (!canEditMasterForSchool(session, input.schoolId)) throw new AppError(403, "Forbidden (target school)");
  if (input.costRatio < 0 || input.costRatio > 100) throw new AppError(400, "コスト按分は 0-100 の範囲");

  // Validate total cost ratio across all assignments doesn't exceed 100
  const existing = db.assignmentsByEmployee(input.employeeId) as any[];
  const totalCost = existing.reduce((s, a) => s + (a.costRatio || 0), 0) + input.costRatio;
  if (totalCost > 100) throw new AppError(400, `合計コスト按分が 100% を超えます（現在 ${totalCost}%）`);

  const id = `asg_${randomBytes(5).toString("hex")}`;
  db.insertAssignment({
    id,
    employeeId: input.employeeId,
    schoolId: input.schoolId,
    departmentId: input.departmentId,
    position: input.position,
    isPrimary: false,
    assignmentType: input.assignmentType,
    costRatio: input.costRatio,
    managerEmployeeId: input.managerEmployeeId ?? null,
    evaluatorEmployeeId: input.managerEmployeeId ?? null,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
  });

  await logAudit({
    session, action: "assignment.add",
    resourceType: "employee_assignment", resourceId: id,
    after: { employeeId: input.employeeId, schoolId: input.schoolId, costRatio: input.costRatio, totalAfter: totalCost },
  });
  revalidatePath(`/organization/employees/${input.employeeId}`);
  return { ok: true as const, id };
}

export async function deleteAssignmentAction(employeeId: string, assignmentId: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const emp = db.employee(employeeId);
  if (!emp) throw new AppError(404, "Employee not found");
  if (!canEditMasterForSchool(session, emp.schoolId)) throw new AppError(403, "Forbidden");
  // The DB-layer deleteAssignment refuses to delete primary
  db.deleteAssignment(assignmentId);
  await logAudit({
    session, action: "assignment.delete",
    resourceType: "employee_assignment", resourceId: assignmentId,
  });
  revalidatePath(`/organization/employees/${employeeId}`);
  return { ok: true as const };
}
