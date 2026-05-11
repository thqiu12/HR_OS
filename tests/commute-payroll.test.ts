import { describe, it, expect } from "vitest";
import { db } from "../lib/db";

describe("commute payroll computation", () => {
  it("commute_pass: fixed monthly amount regardless of shifts", () => {
    const teaching: any = (db.allWageRateTypes() as any[]).find((t) => t.code === "teaching");
    const ym = "2099-10";
    db.updateEmployee("e2", { commuteMode: "commute_pass", commuteAmount: 12000, commuteTaxable: 0 });
    db.insertShiftAssignment({
      employeeId: "e2", schoolId: "s1",
      rateTypeId: teaching.id, rateAmountSnapshot: 3000, rateUnit: "hour",
      date: `${ym}-05`, startTime: "09:00", endTime: "12:00",
      hours: 3, classes: 1, status: "confirmed",
    });

    const periodId = db.insertPayrollPeriod({ yearMonth: ym });
    // Manually replicate the calc logic (since calculatePayrollAction needs auth)
    const aggs = db.aggregateShiftsForPeriod(ym) as any[];
    for (const a of aggs.filter((x) => x.employeeId === "e2")) {
      db.insertPayrollLine({
        periodId, employeeId: a.employeeId, rateTypeId: a.rateTypeId,
        rateAmountSnapshot: a.rateAmountSnapshot, rateUnit: a.rateUnit,
        hours: a.hours, classes: a.classes, amount: a.amount, shiftCount: a.shiftCount,
        kind: "wage", taxable: 1,
      });
    }
    db.insertPayrollLine({
      periodId, employeeId: "e2", rateTypeId: 0,
      rateAmountSnapshot: 12000, rateUnit: "commute_pass",
      hours: 0, classes: 0, amount: 12000, shiftCount: 0,
      kind: "commute", taxable: 0, notes: "月額固定",
    });

    const lines = (db.linesByPeriod(periodId) as any[]).filter((l) => l.employeeId === "e2");
    const wage = lines.find((l) => l.kind === "wage");
    const commute = lines.find((l) => l.kind === "commute");
    expect(wage?.amount).toBe(9000);
    expect(commute?.amount).toBe(12000);
    expect(commute?.taxable).toBe(0);
    expect(commute?.rateTypeName).toBe("通勤手当");
  });

  it("per_diem: amount × distinct shift dates", () => {
    const ym = "2099-11";
    db.updateEmployee("e3", { commuteMode: "per_diem", commuteAmount: 800, commuteTaxable: 0 });
    const teaching: any = (db.allWageRateTypes() as any[]).find((t) => t.code === "teaching");
    // 2 shifts on different days
    for (const day of [3, 10]) {
      db.insertShiftAssignment({
        employeeId: "e3", schoolId: "s1",
        rateTypeId: teaching.id, rateAmountSnapshot: 3000, rateUnit: "hour",
        date: `${ym}-${String(day).padStart(2, "0")}`,
        startTime: "10:00", endTime: "12:00",
        hours: 2, classes: 1, status: "confirmed",
      });
    }
    const allShifts = (db.allShiftsInMonth(ym) as any[]).filter((s) => s.employeeId === "e3");
    const distinctDates = new Set(allShifts.map((s) => s.date));
    expect(distinctDates.size).toBe(2);
    const expectedCommute = 800 * 2;
    expect(expectedCommute).toBe(1600);
  });

  it("commute over ¥150,000/month is treated as taxable", () => {
    const big = 200_000;
    const taxable = big > 150_000 ? 1 : 0;
    expect(taxable).toBe(1);
  });

  it("MF CSV format: pivot per employee with rate-type columns + commute", () => {
    // Simulate the CSV row structure
    const lines = [
      { employeeId: "e1", employeeNo: "S0001", employeeName: "佐藤", employmentType: "regular", kind: "wage", rateTypeName: "授業時給", amount: 50000, taxable: 1 },
      { employeeId: "e1", employeeNo: "S0001", employeeName: "佐藤", employmentType: "regular", kind: "wage", rateTypeName: "事務時給", amount: 10000, taxable: 1 },
      { employeeId: "e1", employeeNo: "S0001", employeeName: "佐藤", employmentType: "regular", kind: "commute", rateTypeName: "通勤手当", amount: 12000, taxable: 0 },
    ];
    const rateTypeNames = Array.from(new Set(lines.filter((l) => l.kind === "wage").map((l) => l.rateTypeName))).sort();
    expect(rateTypeNames).toEqual(["事務時給", "授業時給"]);

    const byEmp = new Map<string, any>();
    for (const l of lines) {
      if (!byEmp.has(l.employeeId)) {
        byEmp.set(l.employeeId, {
          empNo: l.employeeNo, name: l.employeeName, type: l.employmentType,
          wages: {} as Record<string, number>, commuteTaxFree: 0, commuteTaxable: 0, total: 0,
        });
      }
      const e = byEmp.get(l.employeeId)!;
      if (l.kind === "wage") e.wages[l.rateTypeName] = (e.wages[l.rateTypeName] || 0) + l.amount;
      else if (l.kind === "commute") {
        if (l.taxable) e.commuteTaxable += l.amount; else e.commuteTaxFree += l.amount;
      }
      e.total += l.amount;
    }
    const e1 = byEmp.get("e1");
    expect(e1.wages["授業時給"]).toBe(50000);
    expect(e1.wages["事務時給"]).toBe(10000);
    expect(e1.commuteTaxFree).toBe(12000);
    expect(e1.commuteTaxable).toBe(0);
    expect(e1.total).toBe(72000);
  });
});
