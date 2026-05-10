import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import {
  accessibleSchoolIds,
  filterEmployees,
  filterCandidates,
  filterJobs,
  filterOnboardingCases,
  filterReminders,
  filterSchools,
  canSeeModule,
  canEditMaster,
  canApproveOnboarding,
  canMoveCandidateStage,
  canViewEmployee,
  hasRole,
  isGlobal,
} from "@/lib/permissions";
import { sessionFor } from "./fixtures";

const allEmployees = () => db.employees();
const allCandidates = () => db.candidates();
const allJobs = () => db.jobs();
const allCases = () => db.onboardingCases();
const allReminders = () => db.reminders();
const allSchools = () => db.schools();

// =====================================================
// admin (group_admin) — sees everything
// =====================================================
describe("group_admin (admin)", () => {
  const s = () => sessionFor("admin");

  it("isGlobal", () => expect(isGlobal(s())).toBe(true));

  it("can access every school", () => {
    expect(accessibleSchoolIds(s()).sort()).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("sees all employees / candidates / jobs / cases / reminders", () => {
    expect(filterEmployees(s(), allEmployees()).length).toBe(allEmployees().length);
    expect(filterCandidates(s(), allCandidates(), allJobs()).length).toBe(allCandidates().length);
    expect(filterJobs(s(), allJobs()).length).toBe(allJobs().length);
    expect(filterOnboardingCases(s(), allCases()).length).toBe(allCases().length);
    expect(filterReminders(s(), allReminders()).length).toBe(allReminders().length);
    expect(filterSchools(s(), allSchools()).length).toBe(allSchools().length);
  });

  it("can see every module incl. settings", () => {
    expect(canSeeModule(s(), "settings")).toBe(true);
    expect(canSeeModule(s(), "recruiting")).toBe(true);
    expect(canSeeModule(s(), "performance")).toBe(true);
  });

  it("has full action permissions", () => {
    expect(canEditMaster(s())).toBe(true);
    expect(canApproveOnboarding(s())).toBe(true);
    expect(canMoveCandidateStage(s())).toBe(true);
  });
});

// =====================================================
// hr-entity — entity HR (s1+s2 schools under さくら学園)
// =====================================================
describe("entity_hr (hr-entity)", () => {
  const s = () => sessionFor("hr-entity");

  it("not global", () => expect(isGlobal(s())).toBe(false));

  it("only sees schools in their entity (s1+s2)", () => {
    expect(accessibleSchoolIds(s()).sort()).toEqual(["s1", "s2"]);
  });

  it("filters employees to s1+s2 only", () => {
    const emps = filterEmployees(s(), allEmployees());
    const schoolIds = new Set(emps.map((e: any) => e.schoolId));
    expect([...schoolIds].sort()).toEqual(["s1", "s2"]);
  });

  it("filters cases — Lim Hye-Jin (s2) yes, none from s3/s4", () => {
    const cases = filterOnboardingCases(s(), allCases());
    expect(cases.some((c: any) => c.candidateName === "Lim Hye-Jin")).toBe(true);
    expect(cases.every((c: any) => ["s1", "s2"].includes(c.schoolId))).toBe(true);
  });

  it("cannot edit master (entity_hr is not group_admin)", () => {
    // entity_hr DOES get canEditMaster — that's intentional per permissions.ts
    expect(canEditMaster(s())).toBe(true);
  });

  it("cannot see settings module", () => {
    expect(canSeeModule(s(), "settings")).toBe(false);
  });
});

// =====================================================
// hr-s1 — school HR @ s1 only
// =====================================================
describe("school_hr (hr-s1)", () => {
  const s = () => sessionFor("hr-s1");

  it("scope = s1 only", () => {
    expect(accessibleSchoolIds(s())).toEqual(["s1"]);
  });

  it("does not see s2 employees (e.g. Suzuki / e6)", () => {
    const emps = filterEmployees(s(), allEmployees());
    expect(emps.find((e: any) => e.id === "e6")).toBeUndefined();
    expect(emps.every((e: any) => e.schoolId === "s1")).toBe(true);
  });

  it("does not see Lim Hye-Jin onboarding case (s2)", () => {
    const cases = filterOnboardingCases(s(), allCases());
    expect(cases.some((c: any) => c.candidateName === "Lim Hye-Jin")).toBe(false);
    expect(cases.some((c: any) => c.candidateName === "Pham Thu Ha")).toBe(true);
  });

  it("can approve onboarding & move candidates", () => {
    expect(canApproveOnboarding(s())).toBe(true);
    expect(canMoveCandidateStage(s())).toBe(true);
  });

  it("cannot edit master / cannot see settings", () => {
    expect(canEditMaster(s())).toBe(false);
    expect(canSeeModule(s(), "settings")).toBe(false);
  });
});

// =====================================================
// principal-s1 — school principal + d1 manager
// =====================================================
describe("principal + manager (principal-s1)", () => {
  const s = () => sessionFor("principal-s1");

  it("has both roles", () => {
    expect(hasRole(s(), "principal")).toBe(true);
    expect(hasRole(s(), "manager")).toBe(true);
  });

  it("scope includes s1 (because principal of s1 + manager of d1 which lives in s1)", () => {
    expect(accessibleSchoolIds(s())).toEqual(["s1"]);
  });

  it("via principal role, sees ALL s1 employees (not just d1 dept)", () => {
    const emps = filterEmployees(s(), allEmployees());
    expect(emps.some((e: any) => e.departmentId === "d2")).toBe(true); // 事務部
    expect(emps.some((e: any) => e.departmentId === "d3")).toBe(true); // 学生支援部
  });

  it("can move candidate stage and approve onboarding", () => {
    expect(canMoveCandidateStage(s())).toBe(true);
    expect(canApproveOnboarding(s())).toBe(false); // only HR roles approve docs
  });
});

// =====================================================
// manager-s2 — pure manager of d4 (日本語学科 in s2)
// =====================================================
describe("manager only (manager-s2)", () => {
  const s = () => sessionFor("manager-s2");

  it("scope = s2 only (via dept→school resolution)", () => {
    expect(accessibleSchoolIds(s())).toEqual(["s2"]);
  });

  it("only sees employees in d4 (their dept)", () => {
    const emps = filterEmployees(s(), allEmployees());
    expect(emps.every((e: any) => e.departmentId === "d4")).toBe(true);
    // Should NOT see Park Min-Jun who is in d5 ビジネス学科 (different dept, same school)
    expect(emps.some((e: any) => e.id === "e8")).toBe(false);
  });

  it("can move candidates but cannot approve onboarding", () => {
    expect(canMoveCandidateStage(s())).toBe(true);
    expect(canApproveOnboarding(s())).toBe(false);
  });

  it("cannot see settings", () => {
    expect(canSeeModule(s(), "settings")).toBe(false);
  });
});

// =====================================================
// tanaka — plain employee
// =====================================================
describe("employee only (tanaka)", () => {
  const s = () => sessionFor("tanaka");

  it("only sees self in employees", () => {
    const emps = filterEmployees(s(), allEmployees());
    expect(emps.length).toBe(1);
    expect(emps[0].id).toBe("e2"); // tanaka's employee record
  });

  it("cannot view another employee", () => {
    const sato = db.employee("e1");
    expect(canViewEmployee(s(), sato)).toBe(false);
  });

  it("can view themself", () => {
    const tanaka = db.employee("e2");
    expect(canViewEmployee(s(), tanaka)).toBe(true);
  });

  it("filterCandidates returns empty (no recruiting access)", () => {
    expect(filterCandidates(s(), allCandidates(), allJobs()).length).toBe(0);
  });

  it("filterOnboardingCases returns empty", () => {
    expect(filterOnboardingCases(s(), allCases()).length).toBe(0);
  });

  it("hidden modules: settings, recruiting, onboarding, reminders", () => {
    expect(canSeeModule(s(), "settings")).toBe(false);
    expect(canSeeModule(s(), "recruiting")).toBe(false);
    expect(canSeeModule(s(), "onboarding")).toBe(false);
    expect(canSeeModule(s(), "reminders")).toBe(false);
  });

  it("visible modules: dashboard, organization, performance", () => {
    expect(canSeeModule(s(), "dashboard")).toBe(true);
    expect(canSeeModule(s(), "organization")).toBe(true);
    expect(canSeeModule(s(), "performance")).toBe(true);
  });
});

// =====================================================
// Anonymous (no session)
// =====================================================
describe("no session", () => {
  it("everything returns empty / false", () => {
    expect(filterEmployees(null, allEmployees())).toEqual([]);
    expect(filterCandidates(null, allCandidates(), allJobs())).toEqual([]);
    expect(filterOnboardingCases(null, allCases())).toEqual([]);
    expect(filterReminders(null, allReminders())).toEqual([]);
    expect(canSeeModule(null, "dashboard")).toBe(false);
    expect(canApproveOnboarding(null)).toBe(false);
  });
});
