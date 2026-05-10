import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { filterJobs, canEditMaster, hasRole, canSeeModule } from "@/lib/permissions";
import { Card, CardHeader, Badge, Button, Forbidden } from "@/components/ui";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canSeeModule(session, "recruiting")) return <Forbidden />;
  const jobs: any[] = filterJobs(session, db.jobs());
  const schools: any[] = db.schools();
  const departments: any[] = db.departments();
  const candidates: any[] = db.candidates();
  const canCreate = canEditMaster(session) || hasRole(session, "school_hr");

  const enriched = jobs.map((j) => ({
    ...j,
    schoolName: schools.find((s) => s.id === j.schoolId)?.name || "",
    deptName: departments.find((d) => d.id === j.departmentId)?.name || "",
    applicants: candidates.filter((c) => c.jobId === j.id).length,
  }));

  return (
    <Card>
      <CardHeader
        title="求人一覧"
        subtitle={`${enriched.length}件`}
        right={canCreate && (
          <Link href="/recruiting/jobs/new" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-medium hover:bg-brand-700">
            <Plus size={14} />求人を作成
          </Link>
        )}
      />
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs">
          <tr>
            <th className="text-left px-5 py-2 font-medium">タイトル</th>
            <th className="text-left px-5 py-2 font-medium">学校 / 部門</th>
            <th className="text-left px-5 py-2 font-medium">ルート</th>
            <th className="text-left px-5 py-2 font-medium">ステータス</th>
            <th className="text-right px-5 py-2 font-medium">募集 / 応募</th>
            <th className="text-left px-5 py-2 font-medium">公開日</th>
            <th className="px-5 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {enriched.length === 0 && (
            <tr><td colSpan={7} className="text-center text-sm text-slate-400 py-8">求人がありません</td></tr>
          )}
          {enriched.map((j) => (
            <tr key={j.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-medium">{j.title}</td>
              <td className="px-5 py-3 text-slate-600 text-xs">{j.schoolName}<br /><span className="text-slate-400">{j.deptName}</span></td>
              <td className="px-5 py-3"><Badge tone={j.route === "新卒" ? "blue" : "violet"}>{j.route}</Badge></td>
              <td className="px-5 py-3"><Badge tone={j.status === "公開中" ? "emerald" : j.status === "停止" ? "rose" : "slate"}>{j.status}</Badge></td>
              <td className="px-5 py-3 text-right">{j.openCount} / <b>{j.applicants}</b></td>
              <td className="px-5 py-3 text-slate-600">{j.postedAt}</td>
              <td className="px-5 py-3 text-right">
                <Link href={`/recruiting/pipeline?job=${j.id}`} className="text-brand-600 inline-flex items-center text-xs hover:underline">
                  パイプライン<ChevronRight size={14} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
