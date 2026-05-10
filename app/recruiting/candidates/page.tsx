import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { filterCandidates, canSeeModule } from "@/lib/permissions";
import { Card, CardHeader, Badge, Forbidden } from "@/components/ui";
import Link from "next/link";
import { ChevronRight, Paperclip } from "lucide-react";

export const dynamic = "force-dynamic";

const STAGE_TONE: Record<string, any> = {
  "応募": "slate", "書類選考": "slate", "一次面接": "blue", "二次面接": "blue",
  "条件提示": "amber", "内定": "emerald", "入社手続き": "emerald", "入社済": "indigo", "不採用": "rose",
};

export default async function Page({ searchParams }: { searchParams: { stage?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canSeeModule(session, "recruiting")) return <Forbidden />;
  let candidates: any[] = filterCandidates(session, db.candidates(), db.jobs());
  if (searchParams.stage) candidates = candidates.filter((c) => c.stage === searchParams.stage);
  const jobs: any[] = db.jobs();

  const stageCounts: Record<string, number> = {};
  for (const c of filterCandidates(session, db.candidates(), db.jobs())) {
    stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;
  }
  const stages = ["応募","書類選考","一次面接","二次面接","条件提示","内定","入社手続き","入社済","不採用"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/recruiting/candidates" className={`px-3 py-1.5 text-xs rounded-md ${!searchParams.stage ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
          すべて ({candidates.length})
        </Link>
        {stages.map((s) => (
          <Link
            key={s}
            href={`/recruiting/candidates?stage=${encodeURIComponent(s)}`}
            className={`px-3 py-1.5 text-xs rounded-md ${searchParams.stage === s ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            {s} ({stageCounts[s] || 0})
          </Link>
        ))}
      </div>

      <div className="flex justify-end">
        <Link href="/recruiting/candidates/import" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium">
          📥 CSV インポート
        </Link>
      </div>

      <Card>
        <CardHeader title="候補者一覧" subtitle={`${candidates.length}件`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-5 py-2 font-medium">氏名</th>
              <th className="text-left px-5 py-2 font-medium">JLPT / 国籍</th>
              <th className="text-left px-5 py-2 font-medium">応募求人</th>
              <th className="text-left px-5 py-2 font-medium">ステージ</th>
              <th className="text-left px-5 py-2 font-medium">応募日</th>
              <th className="text-right px-5 py-2 font-medium">添付</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.length === 0 && (
              <tr><td colSpan={7} className="text-center text-sm text-slate-400 py-8">該当する候補者がいません</td></tr>
            )}
            {candidates.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3"><div className="font-medium">{c.flag} {c.name}</div><div className="text-xs text-slate-500">{c.kana}</div></td>
                <td className="px-5 py-3 text-xs">{c.jlpt && <Badge tone="violet" size="xs">{c.jlpt}</Badge>} <span className="text-slate-500">{c.nationality}</span></td>
                <td className="px-5 py-3 text-xs text-slate-600">{jobs.find((j) => j.id === c.jobId)?.title}</td>
                <td className="px-5 py-3"><Badge tone={STAGE_TONE[c.stage] || "slate"}>{c.stage}</Badge></td>
                <td className="px-5 py-3">{c.appliedAt}</td>
                <td className="px-5 py-3 text-right text-xs text-slate-600 inline-flex items-center gap-1 justify-end"><Paperclip size={11} />{c.attachments}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/recruiting/candidates/${c.id}`} className="text-brand-600 inline-flex items-center text-xs hover:underline">詳細<ChevronRight size={14} /></Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
