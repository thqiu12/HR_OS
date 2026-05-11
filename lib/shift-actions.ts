"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "./db";
import { canEditMasterForSchool } from "./permissions";
import { logAudit } from "./audit";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function diffHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

function snapshotRate(employeeId: string, rateTypeId: number, asOf: string): { amount: number; unit: string } {
  // Active rate for that type at the given date
  const active = (db.activeWageRatesFor(employeeId) as any[]).find((r) => r.rateTypeId === rateTypeId);
  if (active) return { amount: active.amount, unit: active.typeUnit };
  // Fall back to the rate type's default_amount
  const rt = db.wageRateType(rateTypeId);
  if (!rt) throw new AppError(400, "賃率種別が見つかりません");
  return { amount: rt.defaultAmount ?? 0, unit: rt.unit };
}

// ===== Shift patterns =====

export async function createShiftPatternAction(input: {
  employeeId: string;
  schoolId: string;
  courseId?: string;
  rateTypeId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!canEditMasterForSchool(session, input.schoolId)) throw new AppError(403, "Forbidden");
  if (!HHMM.test(input.startTime) || !HHMM.test(input.endTime)) throw new AppError(400, "時刻は HH:MM 形式で");
  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) throw new AppError(400, "曜日は 0-6");

  db.insertShiftPattern({ ...input, createdBy: session.user.id });
  await logAudit({
    session, action: "shift.pattern.create",
    resourceType: "employee", resourceId: input.employeeId,
    after: input,
  });
  revalidatePath("/staffing/shifts/patterns");
  revalidatePath(`/organization/employees/${input.employeeId}`);
  return { ok: true as const };
}

export async function endShiftPatternAction(patternId: number, effectiveTo: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const p = db.shiftPatternById(patternId);
  if (!p) throw new AppError(404, "Pattern not found");
  if (!canEditMasterForSchool(session, p.schoolId)) throw new AppError(403, "Forbidden");
  db.endShiftPattern(patternId, effectiveTo);
  await logAudit({ session, action: "shift.pattern.end", resourceType: "shift_pattern", resourceId: String(patternId), after: { effectiveTo } });
  revalidatePath("/staffing/shifts/patterns");
  return { ok: true as const };
}

/**
 * Generate shift_assignments for a month from active patterns.
 * Skips dates that already have an assignment for the same employee+pattern.
 */
export async function generateMonthFromPatternsAction(input: {
  yearMonth: string; // 'YYYY-MM'
  schoolId?: string;
  employeeId?: string;
}) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!/^\d{4}-\d{2}$/.test(input.yearMonth)) throw new AppError(400, "yearMonth は YYYY-MM");

  const [y, m] = input.yearMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  let generated = 0;

  // Collect patterns scoped to school/employee filter
  let patterns: any[] = [];
  if (input.employeeId) {
    patterns = db.patternsByEmployee(input.employeeId) as any[];
  } else if (input.schoolId) {
    if (!canEditMasterForSchool(session, input.schoolId)) throw new AppError(403, "Forbidden");
    patterns = db.patternsBySchool(input.schoolId) as any[];
  } else {
    throw new AppError(400, "schoolId か employeeId を指定してください");
  }

  for (const p of patterns) {
    if (!canEditMasterForSchool(session, p.schoolId)) continue;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${input.yearMonth}-${String(day).padStart(2, "0")}`;
      const dow = new Date(date).getDay();
      if (dow !== p.dayOfWeek) continue;
      // Respect effective range
      if (date < p.effectiveFrom) continue;
      if (p.effectiveTo && date > p.effectiveTo) continue;
      // Skip if existing assignment for same emp/date/start
      const existing = (db.shiftsByEmployeeMonth(p.employeeId, input.yearMonth) as any[])
        .find((a) => a.date === date && a.startTime === p.startTime);
      if (existing) continue;
      const snap = snapshotRate(p.employeeId, p.rateTypeId, date);
      const hours = diffHours(p.startTime, p.endTime);
      db.insertShiftAssignment({
        employeeId: p.employeeId,
        schoolId: p.schoolId,
        courseId: p.courseId,
        rateTypeId: p.rateTypeId,
        rateAmountSnapshot: snap.amount,
        rateUnit: snap.unit,
        date,
        startTime: p.startTime,
        endTime: p.endTime,
        hours,
        classes: snap.unit === "class" ? 1 : 0,
        status: "planned",
        patternId: p.id,
      });
      generated++;
    }
  }

  await logAudit({
    session, action: "shift.generate_from_patterns",
    after: { yearMonth: input.yearMonth, generated, schoolId: input.schoolId, employeeId: input.employeeId },
  });
  revalidatePath("/staffing/shifts");
  return { ok: true as const, generated };
}

// ===== Individual shift CRUD =====

export async function createShiftAssignmentAction(input: {
  employeeId: string;
  schoolId: string;
  courseId?: string;
  rateTypeId: number;
  date: string;
  startTime: string;
  endTime: string;
  classes?: number;
  notes?: string;
}) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!canEditMasterForSchool(session, input.schoolId)) throw new AppError(403, "Forbidden");
  if (!HHMM.test(input.startTime) || !HHMM.test(input.endTime)) throw new AppError(400, "時刻は HH:MM 形式で");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new AppError(400, "date は YYYY-MM-DD");

  const snap = snapshotRate(input.employeeId, input.rateTypeId, input.date);
  const hours = diffHours(input.startTime, input.endTime);
  db.insertShiftAssignment({
    ...input,
    rateAmountSnapshot: snap.amount,
    rateUnit: snap.unit,
    hours,
    classes: input.classes ?? (snap.unit === "class" ? 1 : 0),
    status: "planned",
  });
  await logAudit({
    session, action: "shift.create",
    resourceType: "employee", resourceId: input.employeeId,
    after: { date: input.date, hours, amount: snap.amount * hours },
  });
  revalidatePath("/staffing/shifts");
  return { ok: true as const };
}

export async function updateShiftAssignmentAction(id: number, fields: Record<string, any>) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const a = db.shiftAssignmentById(id);
  if (!a) throw new AppError(404, "Shift not found");
  if (!canEditMasterForSchool(session, a.schoolId)) throw new AppError(403, "Forbidden");

  // Recompute hours if time fields changed
  if (fields.startTime || fields.endTime) {
    const start = fields.startTime ?? a.startTime;
    const end = fields.endTime ?? a.endTime;
    if (!HHMM.test(start) || !HHMM.test(end)) throw new AppError(400, "時刻は HH:MM");
    fields.hours = diffHours(start, end);
  }

  db.updateShiftAssignment(id, fields);
  await logAudit({ session, action: "shift.update", resourceType: "shift_assignment", resourceId: String(id), after: fields });
  revalidatePath("/staffing/shifts");
  return { ok: true as const };
}

export async function cancelShiftAssignmentAction(id: number, reason: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const a = db.shiftAssignmentById(id);
  if (!a) throw new AppError(404, "Shift not found");
  if (!canEditMasterForSchool(session, a.schoolId)) throw new AppError(403, "Forbidden");
  db.updateShiftAssignment(id, { status: "cancelled", notes: reason });
  await logAudit({ session, action: "shift.cancel", resourceType: "shift_assignment", resourceId: String(id), reason });
  revalidatePath("/staffing/shifts");
  return { ok: true as const };
}

export async function deleteShiftAssignmentAction(id: number) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const a = db.shiftAssignmentById(id);
  if (!a) throw new AppError(404, "Shift not found");
  if (!canEditMasterForSchool(session, a.schoolId)) throw new AppError(403, "Forbidden");
  if (a.payrollPeriodId) throw new AppError(400, "給与確定済のシフトは削除できません");
  db.deleteShiftAssignment(id);
  await logAudit({ session, action: "shift.delete", resourceType: "shift_assignment", resourceId: String(id) });
  revalidatePath("/staffing/shifts");
  return { ok: true as const };
}
