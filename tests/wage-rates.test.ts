import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../lib/db";

describe("wage rate types: scope visibility", () => {
  it("seed inserts 5 group-wide types", () => {
    const groupTypes = (db.allWageRateTypes() as any[]).filter((t) => t.scopeType === "group");
    expect(groupTypes.length).toBeGreaterThanOrEqual(5);
    const codes = groupTypes.map((t) => t.code);
    expect(codes).toContain("teaching");
    expect(codes).toContain("admin");
    expect(codes).toContain("meeting");
    expect(codes).toContain("substitute");
    expect(codes).toContain("per_class");
  });

  it("scope filter: school sees group + own school types", () => {
    const visibleForS1 = db.wageRateTypesFor({ entity: "学校法人さくら学園", schoolId: "s1" }) as any[];
    expect(visibleForS1.length).toBeGreaterThanOrEqual(5);
    expect(visibleForS1.every((t) => t.active)).toBe(true);
  });

  it("can add a custom rate type at school scope", () => {
    db.insertWageRateType({
      scopeType: "school",
      scopeId: "s1",
      code: "homeroom_bonus",
      name: "担任手当時給",
      unit: "hour",
      defaultAmount: 500,
      sortOrder: 200,
    });
    const visible = db.wageRateTypesFor({ schoolId: "s1" }) as any[];
    expect(visible.find((t) => t.code === "homeroom_bonus")).toBeTruthy();
    // Other schools should NOT see s1's custom type
    const visibleForS2 = db.wageRateTypesFor({ schoolId: "s2" }) as any[];
    expect(visibleForS2.find((t) => t.code === "homeroom_bonus")).toBeUndefined();
  });

  it("rejects deletion of a type that's in use by an employee", () => {
    const teaching: any = (db.allWageRateTypes() as any[]).find((t) => t.code === "teaching");
    db.addEmployeeWageRate({
      employeeId: "e1",
      rateTypeId: teaching.id,
      amount: 4000,
      effectiveFrom: "2026-04-01",
    });
    expect(() => db.deleteWageRateType(teaching.id)).toThrow(/使用中/);
  });
});

describe("employee wage rates: history + active", () => {
  beforeAll(() => {
    // ensure clean for e2
    // (intentionally skipping — relies on db isolation per test file)
  });

  it("addEmployeeWageRate closes any prior active rate for the same type", () => {
    const teaching: any = (db.allWageRateTypes() as any[]).find((t) => t.code === "teaching");
    db.addEmployeeWageRate({
      employeeId: "e2",
      rateTypeId: teaching.id,
      amount: 3000,
      effectiveFrom: "2024-04-01",
    });
    db.addEmployeeWageRate({
      employeeId: "e2",
      rateTypeId: teaching.id,
      amount: 3500,
      effectiveFrom: "2025-04-01",
    });
    const active = db.activeWageRatesFor("e2") as any[];
    const teachingActive = active.filter((r) => r.typeCode === "teaching");
    expect(teachingActive.length).toBe(1);
    expect(teachingActive[0].amount).toBe(3500);

    const history = db.wageRateHistoryFor("e2") as any[];
    const teachingHistory = history.filter((r) => r.rateTypeId === teaching.id);
    expect(teachingHistory.length).toBeGreaterThanOrEqual(2);
  });

  it("multiple types can be active at once for one employee", () => {
    const admin: any = (db.allWageRateTypes() as any[]).find((t) => t.code === "admin");
    db.addEmployeeWageRate({
      employeeId: "e2",
      rateTypeId: admin.id,
      amount: 1500,
      effectiveFrom: "2025-04-01",
    });
    const active = db.activeWageRatesFor("e2") as any[];
    const codes = active.map((a) => a.typeCode);
    expect(codes).toContain("teaching");
    expect(codes).toContain("admin");
  });

  it("endEmployeeWageRate closes a rate without replacement", () => {
    const meeting: any = (db.allWageRateTypes() as any[]).find((t) => t.code === "meeting");
    db.addEmployeeWageRate({
      employeeId: "e3",
      rateTypeId: meeting.id,
      amount: 1500,
      effectiveFrom: "2025-04-01",
    });
    const before = (db.activeWageRatesFor("e3") as any[]).find((r) => r.typeCode === "meeting");
    expect(before).toBeTruthy();
    db.endEmployeeWageRate(before.id, "2026-03-31");
    const after = (db.activeWageRatesFor("e3") as any[]).find((r) => r.typeCode === "meeting");
    expect(after).toBeUndefined();
  });
});
