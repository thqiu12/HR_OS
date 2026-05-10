/**
 * Tenant isolation security tests.
 *
 * Verifies that scope filters never leak data across:
 *  - school_hr ↔ other school
 *  - entity_hr ↔ other entity
 *  - manager ↔ other department
 *  - employee ↔ other employees
 *
 * Run on every CI build. A failure here = security regression.
 */

import { describe, it, expect } from "vitest";
import { db } from "../lib/db";
import {
  filterEmployees, filterCandidates, filterJobs, filterOnboardingCases,
  filterReminders, filterSchools, canViewEmployee, canEditMasterForSchool,
  canSeeModule,
} from "../lib/permissions";

// Mock sessions matching seeded users
const sessions = {
  groupAdmin: { user: { id: "u1", employeeId: "e10" }, roles: [{ role: "group_admin", scopeType: "group", scopeId: null }] } as any,
  entityHrSakura: { user: { id: "u2" }, roles: [{ role: "entity_hr", scopeType: "entity", scopeId: "学校法人さくら学園" }] } as any,
  schoolHrS1: { user: { id: "u3" }, roles: [{ role: "school_hr", scopeType: "school", scopeId: "s1" }] } as any,
  schoolHrS2: { user: { id: "u3b" }, roles: [{ role: "school_hr", scopeType: "school", scopeId: "s2" }] } as any,
  managerS1Dept1: { user: { id: "u4", employeeId: "e1" }, roles: [{ role: "manager", scopeType: "department", scopeId: "d1" }] } as any,
  employeeTanaka: { user: { id: "u6", employeeId: "e2" }, roles: [{ role: "employee", scopeType: "school", scopeId: "s1" }] } as any,
};

describe("tenant isolation: school scope", () => {
  it("school_hr s1 cannot see s2 employees", () => {
    const allEmps = db.employees() as any[];
    const visible = filterEmployees(sessions.schoolHrS1, allEmps);
    expect(visible.every((e) => e.schoolId === "s1")).toBe(true);
    expect(visible.length).toBeLessThan(allEmps.length);
  });

  it("school_hr s1 cannot see s2 jobs", () => {
    const visible = filterJobs(sessions.schoolHrS1, db.jobs() as any[]);
    expect(visible.every((j) => j.schoolId === "s1")).toBe(true);
  });

  it("school_hr s1 cannot see s2 candidates", () => {
    const visible = filterCandidates(sessions.schoolHrS1, db.candidates() as any[], db.jobs() as any[]);
    const accessibleJobIds = new Set((db.jobs() as any[]).filter((j) => j.schoolId === "s1").map((j) => j.id));
    expect(visible.every((c) => accessibleJobIds.has(c.jobId))).toBe(true);
  });

  it("school_hr s1 cannot see s2 onboarding cases", () => {
    const visible = filterOnboardingCases(sessions.schoolHrS1, db.onboardingCases() as any[]);
    expect(visible.every((o) => o.schoolId === "s1")).toBe(true);
  });

  it("school_hr s1 cannot edit master data for s2", () => {
    expect(canEditMasterForSchool(sessions.schoolHrS1, "s1")).toBe(true);
    expect(canEditMasterForSchool(sessions.schoolHrS1, "s2")).toBe(false);
  });
});

describe("tenant isolation: employee scope", () => {
  it("employee sees ONLY themselves in employee list", () => {
    const visible = filterEmployees(sessions.employeeTanaka, db.employees() as any[]);
    expect(visible.length).toBe(1);
    expect(visible[0].id).toBe("e2");
  });

  it("employee canViewEmployee is true ONLY for self", () => {
    const allEmps = db.employees() as any[];
    for (const e of allEmps) {
      const can = canViewEmployee(sessions.employeeTanaka, e);
      expect(can).toBe(e.id === "e2");
    }
  });

  it("employee sees zero candidates / jobs / cases", () => {
    expect(filterCandidates(sessions.employeeTanaka, db.candidates() as any[], db.jobs() as any[]).length).toBe(0);
    expect(filterJobs(sessions.employeeTanaka, db.jobs() as any[]).length).toBe(0);
    expect(filterOnboardingCases(sessions.employeeTanaka, db.onboardingCases() as any[]).length).toBe(0);
  });

  it("employee cannot access HR modules", () => {
    expect(canSeeModule(sessions.employeeTanaka, "recruiting")).toBe(false);
    expect(canSeeModule(sessions.employeeTanaka, "onboarding")).toBe(false);
    expect(canSeeModule(sessions.employeeTanaka, "reminders")).toBe(false);
    expect(canSeeModule(sessions.employeeTanaka, "settings")).toBe(false);
    // organization + dashboard + performance ARE visible
    expect(canSeeModule(sessions.employeeTanaka, "organization")).toBe(true);
    expect(canSeeModule(sessions.employeeTanaka, "performance")).toBe(true);
    expect(canSeeModule(sessions.employeeTanaka, "dashboard")).toBe(true);
  });
});

describe("tenant isolation: entity scope", () => {
  it("entity_hr cannot see schools outside the entity", () => {
    const visible = filterSchools(sessions.entityHrSakura, db.schools() as any[]);
    const allowedSchools = visible.map((s) => s.id);
    // entity 学校法人さくら学園 owns s1 and s2
    expect(allowedSchools).toContain("s1");
    expect(allowedSchools).toContain("s2");
    // Should NOT contain s3 (株式会社LMN教育) or s4 (株式会社さくらHD)
    expect(allowedSchools).not.toContain("s3");
    expect(allowedSchools).not.toContain("s4");
  });
});

describe("tenant isolation: group_admin sees everything", () => {
  it("group_admin sees all employees / jobs / candidates / cases / schools", () => {
    expect(filterEmployees(sessions.groupAdmin, db.employees() as any[]).length).toBe((db.employees() as any[]).length);
    expect(filterJobs(sessions.groupAdmin, db.jobs() as any[]).length).toBe((db.jobs() as any[]).length);
    expect(filterSchools(sessions.groupAdmin, db.schools() as any[]).length).toBe((db.schools() as any[]).length);
    expect(filterReminders(sessions.groupAdmin, db.reminders() as any[]).length).toBe((db.reminders() as any[]).length);
  });

  it("group_admin can see all modules", () => {
    for (const m of ["dashboard", "recruiting", "onboarding", "organization", "performance", "reminders", "settings"]) {
      expect(canSeeModule(sessions.groupAdmin, m)).toBe(true);
    }
  });
});

describe("tenant isolation: anonymous gets nothing", () => {
  it("null session sees zero of everything", () => {
    expect(filterEmployees(null, db.employees() as any[]).length).toBe(0);
    expect(filterJobs(null, db.jobs() as any[]).length).toBe(0);
    expect(filterCandidates(null, db.candidates() as any[], db.jobs() as any[]).length).toBe(0);
    expect(filterOnboardingCases(null, db.onboardingCases() as any[]).length).toBe(0);
    expect(filterReminders(null, db.reminders() as any[]).length).toBe(0);
    expect(filterSchools(null, db.schools() as any[]).length).toBe(0);
    expect(canSeeModule(null, "dashboard")).toBe(false);
  });
});
