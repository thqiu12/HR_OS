import { verifyTeacherPortalToken } from "@/lib/invite-token";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { Card, CardHeader, Badge } from "@/components/ui";
import PortalClient from "./client";

export const dynamic = "force-dynamic";

export default async function TeacherPortalPage({ params, searchParams }: { params: { token: string }; searchParams: { ym?: string } }) {
  const result = await verifyTeacherPortalToken(params.token);

  if (result.ok === false) {
    await logAudit({ action: "teacher.portal.verify.failed", reason: result.reason });
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-pink-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white rounded-2xl shadow-card p-8 text-center">
          <div className="text-5xl">🚫</div>
          <h1 className="mt-4 font-bold text-lg">この招待リンクは無効です</h1>
          <p className="text-sm text-slate-500 mt-2">{messageFor(result.reason)}</p>
          <p className="text-xs text-slate-400 mt-4">学校の HR 担当者に新しい URL の発行を依頼してください。</p>
        </div>
      </div>
    );
  }

  const e: any = db.employee(result.employeeId);
  if (!e) return <div className="p-12 text-center text-sm text-slate-500">社員データが見つかりません</div>;

  await logAudit({
    action: "teacher.portal.view",
    resourceType: "employee", resourceId: e.id,
    user: { loginId: `portal:${result.jti}` },
  });

  // Default to current month
  const today = new Date();
  const ym = searchParams.ym || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const shifts: any[] = db.shiftsByEmployeeMonth(e.id, ym) as any[];
  const rateTypes = db.allWageRateTypes() as any[];
  const rtName = (id: number) => rateTypes.find((t) => t.id === id)?.name || `#${id}`;

  // Pull all locked/exported payroll periods for this employee (for payslip list)
  const periods = (db.allPayrollPeriods(24) as any[]).filter((p) => p.status !== "open");
  const payslips = periods.map((p) => {
    const lines = (db.linesByPeriod(p.id) as any[]).filter((l) => l.employeeId === e.id);
    const total = lines.reduce((s, l) => s + l.amount, 0);
    return { yearMonth: p.yearMonth, status: p.status, total, lines };
  }).filter((p) => p.lines.length > 0);

  const school: any = db.schoolById(e.schoolId);
  return (
    <PortalClient
      employee={{ id: e.id, name: e.name, empNo: e.empNo, employmentType: e.employmentType, schoolName: school?.name }}
      yearMonth={ym}
      shifts={shifts.map((s) => ({ ...s, rateTypeName: rtName(s.rateTypeId) }))}
      payslips={payslips}
      tokenExpiresAt={result.expiresAt}
    />
  );
}

function messageFor(reason: string): string {
  switch (reason) {
    case "expired": return "リンクの有効期限が切れています。";
    case "invalid_signature": case "wrong_audience": return "リンクが正しくありません。";
    case "unknown_jti": return "リンクが取り消されたか、システム上に登録されていません。";
    case "revoked": return "このリンクは取り消されました。";
    case "rate_limited": return "アクセスが集中しています。少し時間を置いてから再度開いてください。";
    default: return "認証に失敗しました。";
  }
}
