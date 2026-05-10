import { db } from "@/lib/db";
import { stages } from "@/lib/mock";
import { auth } from "@/auth";
import {
  filterEmployees, filterCandidates, filterJobs,
  filterOnboardingCases, filterReminders, filterSchools,
  canSeeModule,
} from "@/lib/permissions";
import DashboardClient from "./client";

export const dynamic = "force-dynamic";

function periodCutoff(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "today": { const d = new Date(now); d.setHours(0,0,0,0); return d; }
    case "this_week": { const d = new Date(now); const day = d.getDay(); d.setDate(d.getDate() - day); d.setHours(0,0,0,0); return d; }
    case "this_month": { return new Date(now.getFullYear(), now.getMonth(), 1); }
    case "last_30d": { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
    case "this_quarter": { const q = Math.floor(now.getMonth() / 3); return new Date(now.getFullYear(), q*3, 1); }
    case "this_year": { return new Date(now.getFullYear(), 0, 1); }
    case "all": default: return null;
  }
}

export default async function Page({ searchParams }: { searchParams: { entity?: string; school?: string; dept?: string; period?: string } }) {
  const session = await auth();

  // Apply scope filters
  let employees = filterEmployees(session, db.employees());
  let jobs = filterJobs(session, db.jobs());
  let candidates = filterCandidates(session, db.candidates(), db.jobs());
  let onboardingCases = filterOnboardingCases(session, db.onboardingCases());
  let reminders = filterReminders(session, db.reminders()).filter((r: any) => !r.handledAt);
  let schools = filterSchools(session, db.schools());
  const allSchools = db.schools();

  // Apply URL filter chips
  if (searchParams.entity) {
    schools = schools.filter((s: any) => s.entity === searchParams.entity);
    const ids = new Set(schools.map((s: any) => s.id));
    employees = employees.filter((e: any) => ids.has(e.schoolId));
    jobs = jobs.filter((j: any) => ids.has(j.schoolId));
    onboardingCases = onboardingCases.filter((o: any) => ids.has(o.schoolId));
    reminders = reminders.filter((r: any) => ids.has(r.schoolId));
    const accessibleJobIds = new Set(jobs.map((j: any) => j.id));
    candidates = candidates.filter((c: any) => accessibleJobIds.has(c.jobId));
  }
  if (searchParams.school) {
    schools = schools.filter((s: any) => s.id === searchParams.school);
    employees = employees.filter((e: any) => e.schoolId === searchParams.school);
    jobs = jobs.filter((j: any) => j.schoolId === searchParams.school);
    onboardingCases = onboardingCases.filter((o: any) => o.schoolId === searchParams.school);
    reminders = reminders.filter((r: any) => r.schoolId === searchParams.school);
    const accessibleJobIds = new Set(jobs.map((j: any) => j.id));
    candidates = candidates.filter((c: any) => accessibleJobIds.has(c.jobId));
  }
  if (searchParams.dept) {
    employees = employees.filter((e: any) => e.departmentId === searchParams.dept);
    jobs = jobs.filter((j: any) => j.departmentId === searchParams.dept);
    const accessibleJobIds = new Set(jobs.map((j: any) => j.id));
    candidates = candidates.filter((c: any) => accessibleJobIds.has(c.jobId));
  }

  // Period filter — only applies to "今月内定" / "今月入社" KPIs (period-bounded by name).
  // 公開求人 / 選考中 / 総社員数 / 採用ファネル / 学校別社員数 reflect current state regardless of period.
  const cutoff = periodCutoff(searchParams.period || "this_month");
  const inPeriod = (dateStr: string | null | undefined) => {
    if (!cutoff) return true;
    return String(dateStr || "") >= cutoff.toISOString().slice(0, 10);
  };

  const funnel = stages.map((s) => ({ stage: s, count: candidates.filter((c: any) => c.stage === s).length }));
  const schoolStat = schools.map((s: any) => ({
    name: s.name,
    count: employees.filter((e: any) => e.schoolId === s.id).length,
  }));

  const expiring = reminders.filter((r: any) => r.category === "在留カード期限" && r.severity === "critical");
  const probation = reminders.filter((r: any) => r.category === "試用期間終了");
  const rejected = reminders.filter((r: any) => r.category === "書類差戻し");

  let kpiOrder: string[] | null = null;
  if (session) {
    const raw = db.getUserPref(session.user.id, "dashboard.kpiOrder");
    if (raw) { try { kpiOrder = JSON.parse(raw); } catch {} }
  }

  // Module access flags — drive which dashboard widgets are shown.
  const showRecruiting = canSeeModule(session, "recruiting");
  const showOnboarding = canSeeModule(session, "onboarding");
  const showReminders = canSeeModule(session, "reminders");

  return (
    <DashboardClient
      kpi={{
        openJobs: jobs.filter((j: any) => j.status === "公開中").length,
        inProcess: candidates.filter((c: any) => c.stage !== "入社済" && c.stage !== "不採用").length,
        naitei: candidates.filter((c: any) => (c.stage === "内定" || c.stage === "入社手続き") && inPeriod(c.appliedAt)).length,
        joined: candidates.filter((c: any) => c.stage === "入社済" && inPeriod(c.appliedAt)).length,
        totalEmp: employees.length,
      }}
      funnel={funnel}
      schoolStat={schoolStat}
      alerts={{ expiring: expiring.length, probation: probation.length, rejected: rejected.length }}
      onboardingCases={onboardingCases.map((c: any) => ({
        ...c,
        schoolName: allSchools.find((s: any) => s.id === c.schoolId)?.name || "",
      }))}
      kpiOrder={kpiOrder}
      showRecruiting={showRecruiting}
      showOnboarding={showOnboarding}
      showReminders={showReminders}
    />
  );
}
