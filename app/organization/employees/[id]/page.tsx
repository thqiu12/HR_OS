import { db } from "@/lib/db";
import { Card, Badge, Button } from "@/components/ui";
import { notFound, redirect } from "next/navigation";
import { Mail, Calendar, IdCard } from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { canViewEmployee, canEditMasterForSchool, hasRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { EMPLOYMENT_LABEL, EMPLOYMENT_TONE, WAGE_MODEL } from "@/lib/employment-types";
import EmployeeEditButton from "./edit-button";
import EmployeePiiSection from "./pii-section";
import AssignmentsSection from "./assignments-section";
import WageRatesSection from "./wage-rates-section";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  const e: any = db.employee(params.id);
  if (!e) return notFound();
  if (!canViewEmployee(session, e)) {
    await logAudit({ session, action: "employee.view.denied", resourceType: "employee", resourceId: e.id, reason: "scope" });
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
      </div>
    );
  }
  if (e.zairyuExpiry) {
    await logAudit({ session, action: "employee.pii.view", resourceType: "employee", resourceId: e.id, reason: "zairyu" });
  } else {
    await logAudit({ session, action: "employee.view", resourceType: "employee", resourceId: e.id });
  }
  const manager = e.managerId ? (db.employee(e.managerId) as any) : null;
  const evaluator = e.evaluatorId ? (db.employee(e.evaluatorId) as any) : null;
  const schools = db.schools();
  const departments = db.departments();
  const canEdit = canEditMasterForSchool(session, e.schoolId);
  const piiCt = db.getEmployeePiiCiphertext(e.id);
  const isAdmin = hasRole(session, "group_admin");

  return (
    <div className="space-y-6 max-w-5xl">
      <Card className="p-6 flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-pink-400 text-white flex items-center justify-center text-2xl">{e.flag}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{e.name}</h2>
            <Badge tone="slate">{e.empNo}</Badge>
            <Badge tone={e.status === "在籍" ? "emerald" : "amber"}>{e.status}</Badge>
            <Badge tone={EMPLOYMENT_TONE[(e.employmentType || "regular") as keyof typeof EMPLOYMENT_TONE] as any}>
              {EMPLOYMENT_LABEL[(e.employmentType || "regular") as keyof typeof EMPLOYMENT_LABEL]}
            </Badge>
          </div>
          <div className="text-sm text-slate-500">{e.kana} ・ {e.romaji}</div>
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-y-1.5 gap-x-6 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5"><Mail size={12} />{e.email}</span>
            <span className="inline-flex items-center gap-1.5"><Calendar size={12} />入社 {e.hireDate}</span>
            <span className="inline-flex items-center gap-1.5">国籍 {e.nationality}</span>
            <span className="inline-flex items-center gap-1.5">採用 {e.hireRoute}</span>
            {e.zairyuExpiry && (
              <span className="inline-flex items-center gap-1.5"><IdCard size={12} />在留期限 {e.zairyuExpiry}</span>
            )}
            <span className="inline-flex items-center gap-1.5">試用終了 {e.probationEnd}</span>
            {WAGE_MODEL[(e.employmentType || "regular") as keyof typeof WAGE_MODEL] === "hourly" && e.hourlyRate && (
              <span className="inline-flex items-center gap-1.5">時給 ¥{Number(e.hourlyRate).toLocaleString()}</span>
            )}
            {WAGE_MODEL[(e.employmentType || "regular") as keyof typeof WAGE_MODEL] === "per_class" && e.perClassRate && (
              <span className="inline-flex items-center gap-1.5">コマ給 ¥{Number(e.perClassRate).toLocaleString()}</span>
            )}
            {e.contractRenewalDate && (
              <span className="inline-flex items-center gap-1.5 text-amber-700">契約更新 {e.contractRenewalDate}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/performance/profiles/${e.id}`}>
            <Button variant="secondary" size="sm">評価カルテへ</Button>
          </Link>
          {canEdit && <EmployeeEditButton employee={e} />}
        </div>
      </Card>

      <AssignmentsSection
        employeeId={e.id}
        canEdit={canEdit}
        assignments={(db.assignmentsByEmployee(e.id) as any[]).map((a) => ({
          ...a,
          schoolName: schools.find((s: any) => s.id === a.schoolId)?.name || "",
          deptName: departments.find((d: any) => d.id === a.departmentId)?.name || "",
        }))}
        schools={schools}
        departments={departments}
      />

      <WageRatesSection
        employeeId={e.id}
        canEdit={canEdit}
        activeRates={db.activeWageRatesFor(e.id) as any[]}
        history={db.wageRateHistoryFor(e.id) as any[]}
        availableTypes={(db.wageRateTypesFor({ entity: schools.find((s: any) => s.id === e.schoolId)?.entity, schoolId: e.schoolId }) as any[]).filter((t: any) => t.active)}
      />

      {isAdmin && (
        <EmployeePiiSection employeeId={e.id} hasMyNumber={!!piiCt?.myNumberEnc} hasBank={!!piiCt?.bankAccountEnc} hasPassport={!!piiCt?.passportNoEnc} />
      )}
    </div>
  );
}

