import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { filterEmployees, canEditMaster, hasRole } from "@/lib/permissions";
import { Card, CardHeader, Badge } from "@/components/ui";
import { EMPLOYMENT_LABEL, EMPLOYMENT_TONE, EMPLOYMENT_TYPES } from "@/lib/employment-types";
import Link from "next/link";
import { ChevronRight, Plus, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { status?: string; nationality?: string; q?: string; emp_type?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  let employees: any[] = filterEmployees(session, db.employees());
  const schools: any[] = db.schools();
  const departments: any[] = db.departments();
  const canCreate = canEditMaster(session) || hasRole(session, "school_hr");

  // Pre-filter counts for the chip row (before any filters applied)
  const empTypeCounts: Record<string, number> = {};
  for (const e of employees) {
    const t = e.employmentType || "regular";
    empTypeCounts[t] = (empTypeCounts[t] || 0) + 1;
  }

  if (searchParams.status) employees = employees.filter((e) => e.status === searchParams.status);
  if (searchParams.nationality) employees = employees.filter((e) => e.nationality === searchParams.nationality);
  if (searchParams.emp_type) employees = employees.filter((e) => (e.employmentType || "regular") === searchParams.emp_type);
  if (searchParams.q) {
    const q = searchParams.q.toLowerCase();
    employees = employees.filter((e) => e.name?.toLowerCase().includes(q) || e.kana?.toLowerCase().includes(q) || e.empNo?.toLowerCase().includes(q));
  }

  const statusList = ["在籍", "試用期間", "休職", "退職"];
  const nationalities = [...new Set(employees.map((e) => e.nationality))].sort();
  const today = new Date();
  const buildHref = (override: { emp_type?: string | null }) => {
    const params = new URLSearchParams();
    if (searchParams.status) params.set("status", searchParams.status);
    if (searchParams.nationality) params.set("nationality", searchParams.nationality);
    if (searchParams.q) params.set("q", searchParams.q);
    if (override.emp_type !== null && (override.emp_type !== undefined || searchParams.emp_type)) {
      const v = override.emp_type ?? searchParams.emp_type;
      if (v) params.set("emp_type", v);
    }
    const qs = params.toString();
    return qs ? `/organization/employees?${qs}` : "/organization/employees";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/organization/employees" className={`px-3 py-1.5 text-xs rounded-md ${!searchParams.status ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            すべて ({employees.length})
          </Link>
          {statusList.map((s) => (
            <Link key={s} href={`/organization/employees?status=${encodeURIComponent(s)}`} className={`px-3 py-1.5 text-xs rounded-md ${searchParams.status === s ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              {s}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-400 ml-2">雇用形態:</span>
          <Link href={buildHref({ emp_type: null })} className={`px-2 py-1 text-[11px] rounded ${!searchParams.emp_type ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            全て
          </Link>
          {EMPLOYMENT_TYPES.map((t) => (
            <Link key={t} href={buildHref({ emp_type: t })} className={`px-2 py-1 text-[11px] rounded ${searchParams.emp_type === t ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              {EMPLOYMENT_LABEL[t]} ({empTypeCounts[t] || 0})
            </Link>
          ))}
        </div>
        {canCreate && (
          <div className="flex items-center gap-2">
            <Link href="/organization/employees/import" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium">
              📥 CSV インポート
            </Link>
            <Link href="/organization/employees/new" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-medium hover:bg-brand-700">
              <Plus size={14} />社員追加
            </Link>
          </div>
        )}
      </div>

      <Card>
        <CardHeader title="社員一覧" subtitle={`${employees.length}名`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-5 py-2 font-medium">社員番号 / 氏名</th>
              <th className="text-left px-5 py-2 font-medium">所属</th>
              <th className="text-left px-5 py-2 font-medium">役職</th>
              <th className="text-left px-5 py-2 font-medium">雇用形態</th>
              <th className="text-left px-5 py-2 font-medium">国籍</th>
              <th className="text-left px-5 py-2 font-medium">入社日</th>
              <th className="text-left px-5 py-2 font-medium">在留期限</th>
              <th className="text-left px-5 py-2 font-medium">ステータス</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.length === 0 && (
              <tr><td colSpan={9} className="text-center text-sm text-slate-400 py-8">該当する社員がいません</td></tr>
            )}
            {employees.map((e) => {
              const expiringSoon = e.zairyuExpiry && (new Date(e.zairyuExpiry).getTime() - today.getTime()) < 60 * 86400 * 1000;
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3"><div className="text-[10px] text-slate-500 font-mono">{e.empNo}</div><div className="font-medium">{e.flag} {e.name}</div></td>
                  <td className="px-5 py-3 text-xs text-slate-600">{schools.find((s) => s.id === e.schoolId)?.name}<br /><span className="text-slate-400">{departments.find((d) => d.id === e.departmentId)?.name}</span></td>
                  <td className="px-5 py-3 text-slate-700">{e.position}</td>
                  <td className="px-5 py-3"><Badge tone={EMPLOYMENT_TONE[(e.employmentType || "regular") as keyof typeof EMPLOYMENT_TONE] as any} size="xs">{EMPLOYMENT_LABEL[(e.employmentType || "regular") as keyof typeof EMPLOYMENT_LABEL]}</Badge></td>
                  <td className="px-5 py-3 text-xs">{e.nationality}</td>
                  <td className="px-5 py-3">{e.hireDate}</td>
                  <td className="px-5 py-3">
                    {e.zairyuExpiry ? (
                      <span className={expiringSoon ? "text-rose-600 font-medium inline-flex items-center gap-1" : ""}>
                        {expiringSoon && <AlertTriangle size={11} />}{e.zairyuExpiry}
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-3"><Badge tone={e.status === "在籍" ? "emerald" : e.status === "試用期間" ? "amber" : e.status === "退職" ? "slate" : "blue"}>{e.status}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/organization/employees/${e.id}`} className="text-brand-600 inline-flex items-center text-xs hover:underline">詳細<ChevronRight size={14} /></Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
