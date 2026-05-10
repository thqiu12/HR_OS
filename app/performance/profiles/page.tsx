import { db } from "@/lib/db";
import { Card, CardHeader, Badge } from "@/components/ui";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { filterEmployees } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  const employees: any[] = filterEmployees(session, db.employees());
  const schools: any[] = db.schools();
  const departments: any[] = db.departments();
  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name || "";
  const deptName = (id: string) => departments.find((d) => d.id === id)?.name || "";

  return (
    <Card>
      <CardHeader title="評価カルテ 一覧" subtitle={`アクセス可能な社員：${employees.length}名`} />
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs">
          <tr>
            <th className="text-left px-5 py-2 font-medium">氏名</th>
            <th className="text-left px-5 py-2 font-medium">所属</th>
            <th className="text-left px-5 py-2 font-medium">役職</th>
            <th className="text-left px-5 py-2 font-medium">入社日</th>
            <th className="text-left px-5 py-2 font-medium">試用期間終了</th>
            <th className="text-left px-5 py-2 font-medium">ステータス</th>
            <th className="px-5 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.length === 0 && (
            <tr><td colSpan={7} className="text-center text-sm text-slate-400 py-8">アクセス可能な社員がありません</td></tr>
          )}
          {employees.map((e) => (
            <tr key={e.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-medium">{e.flag} {e.name}</td>
              <td className="px-5 py-3 text-slate-600 text-xs">{schoolName(e.schoolId)} / {deptName(e.departmentId)}</td>
              <td className="px-5 py-3 text-slate-700">{e.position}</td>
              <td className="px-5 py-3">{e.hireDate}</td>
              <td className="px-5 py-3">{e.probationEnd}</td>
              <td className="px-5 py-3">
                <Badge tone={e.status === "在籍" ? "emerald" : e.status === "試用期間" ? "amber" : "slate"}>{e.status}</Badge>
              </td>
              <td className="px-5 py-3 text-right">
                <Link href={`/performance/profiles/${e.id}`} className="text-brand-600 inline-flex items-center text-xs hover:underline">
                  カルテを開く<ChevronRight size={14} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
