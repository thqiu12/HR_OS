import type { Session } from "next-auth";
import { db } from "./db";

export const ROLE_LABEL: Record<string, string> = {
  group_admin: "グループ管理者",
  entity_hr: "法人HR管理者",
  school_hr: "学校HR担当",
  principal: "校長 / 学校長",
  manager: "部門長",
  employee: "一般社員",
  candidate: "内定者",
  executive: "経営層",
  auditor: "監査",
};

export function isGlobal(session: Session | null): boolean {
  if (!session) return false;
  return session.roles.some((r) => ["group_admin", "executive", "auditor"].includes(r.role));
}

export function hasRole(session: Session | null, role: string): boolean {
  return !!session?.roles.some((r) => r.role === role);
}

export function highestRoleLabel(session: Session | null): string {
  if (!session) return "未ログイン";
  const order = ["group_admin", "entity_hr", "school_hr", "principal", "manager", "employee"];
  for (const r of order) if (hasRole(session, r)) return ROLE_LABEL[r];
  return ROLE_LABEL[session.roles[0]?.role] ?? "—";
}

/** Schools the current user can access. */
export function accessibleSchoolIds(session: Session | null): string[] {
  const all = db.schools().map((s: any) => s.id as string);
  if (!session) return [];
  if (isGlobal(session)) return all;
  const allSchools = db.schools() as any[];
  const allDepts = db.departments() as any[];
  const ids = new Set<string>();
  for (const r of session.roles) {
    if (r.role === "entity_hr" && r.scopeType === "entity") {
      allSchools.filter((s) => s.entity === r.scopeId).forEach((s) => ids.add(s.id));
    } else if (r.scopeType === "school" && r.scopeId) {
      ids.add(r.scopeId);
    } else if (r.scopeType === "department" && r.scopeId) {
      const d = allDepts.find((x) => x.id === r.scopeId);
      if (d) ids.add(d.schoolId);
    }
  }
  return [...ids];
}

/** Department IDs the current user can manage (manager scope). */
export function managedDepartmentIds(session: Session | null): string[] {
  if (!session) return [];
  return session.roles
    .filter((r) => r.role === "manager" && r.scopeType === "department" && r.scopeId)
    .map((r) => r.scopeId as string);
}

/** Filter employees by what the current user can see. */
export function filterEmployees(session: Session | null, employees: any[]): any[] {
  if (!session) return [];
  if (isGlobal(session)) return employees;

  const schoolIds = new Set(accessibleSchoolIds(session));

  // entity_hr / school_hr / principal: see everyone in accessible schools
  const broadRoles = ["entity_hr", "school_hr", "principal"];
  if (session.roles.some((r) => broadRoles.includes(r.role))) {
    return employees.filter((e) => schoolIds.has(e.schoolId));
  }

  // manager: only own department employees
  const deptIds = new Set(managedDepartmentIds(session));
  if (deptIds.size > 0) {
    return employees.filter((e) => deptIds.has(e.departmentId));
  }

  // employee: only self
  return employees.filter((e) => e.id === session.user.employeeId);
}

export function canViewEmployee(session: Session | null, employee: any): boolean {
  if (!session || !employee) return false;
  return filterEmployees(session, [employee]).length > 0;
}

/** Filter candidates by accessible school (via job.schoolId). */
export function filterCandidates(session: Session | null, candidates: any[], jobs: any[]): any[] {
  if (!session) return [];
  if (isGlobal(session)) return candidates;
  if (hasRole(session, "employee") && !hasRole(session, "manager")) return [];
  const schoolIds = new Set(accessibleSchoolIds(session));
  const accessibleJobIds = new Set(jobs.filter((j) => schoolIds.has(j.schoolId)).map((j) => j.id));
  return candidates.filter((c) => accessibleJobIds.has(c.jobId));
}

export function filterJobs(session: Session | null, jobs: any[]): any[] {
  if (!session) return [];
  if (isGlobal(session)) return jobs;
  if (hasRole(session, "employee") && !hasRole(session, "manager")) return [];
  const schoolIds = new Set(accessibleSchoolIds(session));
  return jobs.filter((j) => schoolIds.has(j.schoolId));
}

export function filterOnboardingCases(session: Session | null, cases: any[]): any[] {
  if (!session) return [];
  if (isGlobal(session)) return cases;
  if (hasRole(session, "employee") && !hasRole(session, "manager")) return [];
  const schoolIds = new Set(accessibleSchoolIds(session));
  return cases.filter((c) => schoolIds.has(c.schoolId));
}

export function filterReminders(session: Session | null, reminders: any[]): any[] {
  if (!session) return [];
  if (isGlobal(session)) return reminders;
  const schoolIds = new Set(accessibleSchoolIds(session));
  return reminders.filter((r) => schoolIds.has(r.schoolId));
}

export function filterSchools(session: Session | null, schools: any[]): any[] {
  if (!session) return [];
  if (isGlobal(session)) return schools;
  const ids = new Set(accessibleSchoolIds(session));
  return schools.filter((s) => ids.has(s.id));
}

/** Module visibility for sidebar / page guards. */
export function canSeeModule(session: Session | null, module: string): boolean {
  if (!session) return false;
  if (isGlobal(session)) return true;
  switch (module) {
    case "settings":
      return hasRole(session, "group_admin");
    case "reminders":
      return !hasRole(session, "employee") || hasRole(session, "manager");
    case "recruiting":
    case "onboarding":
      return ["entity_hr", "school_hr", "principal", "manager"].some((r) => hasRole(session, r));
    case "performance":
      return ["entity_hr", "school_hr", "principal", "manager", "employee"].some((r) => hasRole(session, r));
    case "organization":
      return true;
    case "dashboard":
      return true;
    default:
      return false;
  }
}

export function canEditMaster(session: Session | null): boolean {
  return hasRole(session, "group_admin") || hasRole(session, "entity_hr");
}

/** Can the user create employees / jobs / departments under the given school? */
export function canEditMasterForSchool(session: Session | null, schoolId: string): boolean {
  if (!session) return false;
  if (isGlobal(session)) return true;
  if (hasRole(session, "entity_hr")) return accessibleSchoolIds(session).includes(schoolId);
  if (hasRole(session, "school_hr")) return accessibleSchoolIds(session).includes(schoolId);
  return false;
}

export function canApproveOnboarding(session: Session | null): boolean {
  return ["group_admin", "entity_hr", "school_hr"].some((r) => hasRole(session, r));
}

export function canMoveCandidateStage(session: Session | null): boolean {
  return ["group_admin", "entity_hr", "school_hr", "principal", "manager"].some((r) => hasRole(session, r));
}

export function canCreateReviewFor(session: Session | null, employee: any): boolean {
  if (!session || !employee) return false;
  if (isGlobal(session)) return true;
  // Any HR or principal of the employee's school
  const allowedRoles = ["entity_hr", "school_hr", "principal"];
  if (allowedRoles.some((r) => hasRole(session, r))) {
    return canViewEmployee(session, employee);
  }
  // Manager: must be the employee's direct manager OR evaluator
  if (hasRole(session, "manager")) {
    return employee.managerId === session.user.employeeId || employee.evaluatorId === session.user.employeeId;
  }
  return false;
}

export function canHandleReminder(session: Session | null, reminder: any): boolean {
  if (!session || !reminder) return false;
  if (isGlobal(session)) return true;
  // Same scope as filterReminders — must be able to see the reminder's school
  const schoolIds = new Set(accessibleSchoolIds(session));
  return schoolIds.has(reminder.schoolId);
}
