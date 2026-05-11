import { describe, it, expect } from "vitest";
import { db } from "../lib/db";

describe("shift + payroll integration", () => {
  it("inserts a shift_pattern and queries it back", () => {
    const teaching: any = (db.allWageRateTypes() as any[]).find((t) => t.code === "teaching");
    db.insertShiftPattern({
      employeeId: "e2", schoolId: "s1",
      rateTypeId: teaching.id,
      dayOfWeek: 1, startTime: "09:00", endTime: "12:00",
      effectiveFrom: "2026-04-01",
    });
    const patterns = db.patternsByEmployee("e2") as any[];
    const found = patterns.find((p) => p.dayOfWeek === 1 && p.startTime === "09:00");
    expect(found).toBeTruthy();
    expect(found.rateTypeId).toBe(teaching.id);
  });

  it("inserts shift assignments and aggregates for payroll", () => {
    const teaching: any = (db.allWageRateTypes() as any[]).find((t) => t.code === "teaching");
    const ym = "2099-08";
    // Insert 3 shifts: 2 confirmed, 1 cancelled
    for (let day = 1; day <= 3; day++) {
      db.insertShiftAssignment({
        employeeId: "e3", schoolId: "s1",
        rateTypeId: teaching.id, rateAmountSnapshot: 3000, rateUnit: "hour",
        date: `${ym}-${String(day).padStart(2, "0")}`,
        startTime: "10:00", endTime: "12:00",
        hours: 2, classes: 1,
        status: day === 3 ? "cancelled" : "confirmed",
      });
    }
    const aggs = (db.aggregateShiftsForPeriod(ym) as any[]).filter((a) => a.employeeId === "e3");
    expect(aggs.length).toBe(1);
    expect(aggs[0].hours).toBe(4); // 2 confirmed shifts × 2h
    expect(aggs[0].amount).toBe(12000); // 4h × ¥3000
    expect(aggs[0].shiftCount).toBe(2);
  });

  it("payroll period: open → lock with totals", () => {
    const teaching: any = (db.allWageRateTypes() as any[]).find((t) => t.code === "teaching");
    const ym = "2099-09";
    db.insertShiftAssignment({
      employeeId: "e2", schoolId: "s1",
      rateTypeId: teaching.id, rateAmountSnapshot: 3500, rateUnit: "hour",
      date: `${ym}-15`, startTime: "10:00", endTime: "13:00",
      hours: 3, classes: 1, status: "confirmed",
    });

    const periodId = db.insertPayrollPeriod({ yearMonth: ym });
    expect(periodId).toBeGreaterThan(0);
    const aggs = db.aggregateShiftsForPeriod(ym) as any[];
    for (const a of aggs) {
      db.insertPayrollLine({
        periodId, employeeId: a.employeeId, rateTypeId: a.rateTypeId,
        rateAmountSnapshot: a.rateAmountSnapshot, rateUnit: a.rateUnit,
        hours: a.hours, classes: a.classes, amount: a.amount, shiftCount: a.shiftCount,
      });
    }
    const lines = db.linesByPeriod(periodId) as any[];
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const total = lines.reduce((s, l) => s + l.amount, 0);
    db.lockPayrollPeriod(periodId, "test", total, new Set(lines.map((l) => l.employeeId)).size);
    const after = db.payrollPeriodById(periodId);
    expect(after.status).toBe("locked");
    expect(after.totalAmount).toBe(total);
  });

  it("teacher portal token: issue + verify", async () => {
    const { issueTeacherPortalToken, verifyTeacherPortalToken } = await import("../lib/invite-token");
    process.env.AUTH_SECRET = process.env.AUTH_SECRET || "0".repeat(64);
    const t = await issueTeacherPortalToken({ employeeId: "e2", days: 1 });
    const v = await verifyTeacherPortalToken(t);
    expect(v.ok).toBe(true);
    if (v.ok === true) expect(v.employeeId).toBe("e2");
  });
});
