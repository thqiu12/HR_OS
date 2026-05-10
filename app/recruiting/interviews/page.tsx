import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { filterCandidates, canSeeModule } from "@/lib/permissions";
import { Card, CardHeader, Badge, Forbidden } from "@/components/ui";
import Link from "next/link";
import { Calendar, Video, MapPin, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canSeeModule(session, "recruiting")) return <Forbidden />;

  const all: any[] = db.allInterviews();
  const candidates: any[] = db.candidates();
  const accessibleCandIds = new Set(filterCandidates(session, candidates, db.jobs() as any[]).map((c: any) => c.id));
  const filtered = all.filter((iv) => accessibleCandIds.has(iv.candidateId));

  const now = new Date().toISOString();
  const upcoming = filtered.filter((iv) => iv.status === "scheduled" && iv.scheduledAt >= now);
  const past = filtered.filter((iv) => iv.status !== "scheduled" || iv.scheduledAt < now);

  const candById = (id: string) => candidates.find((c) => c.id === id);

  const fmtDt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={`📅 予定面接（${upcoming.length}件）`} subtitle="スケジュール済みの面接" />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-5 py-2 font-medium">日時</th>
              <th className="text-left px-5 py-2 font-medium">候補者</th>
              <th className="text-left px-5 py-2 font-medium">面接</th>
              <th className="text-left px-5 py-2 font-medium">形式 / 場所</th>
              <th className="text-left px-5 py-2 font-medium">面接官</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {upcoming.length === 0 && (
              <tr><td colSpan={6} className="text-center text-sm text-slate-400 py-8">予定された面接はありません</td></tr>
            )}
            {upcoming.map((iv) => {
              const c = candById(iv.candidateId);
              return (
                <tr key={iv.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs">{fmtDt(iv.scheduledAt)}<br /><span className="text-slate-400">({iv.durationMin}分)</span></td>
                  <td className="px-5 py-3">{c ? <><div className="font-medium">{c.flag} {c.name}</div><div className="text-xs text-slate-500">{c.kana}</div></> : iv.candidateId}</td>
                  <td className="px-5 py-3"><Badge tone="violet">{iv.round}</Badge></td>
                  <td className="px-5 py-3 text-xs">
                    {iv.format === "online" ? <span className="inline-flex items-center gap-1"><Video size={12} />オンライン</span> : <span className="inline-flex items-center gap-1"><MapPin size={12} />対面</span>}
                    {iv.location && <div className="text-slate-500 mt-0.5 truncate max-w-[180px]">{iv.location}</div>}
                  </td>
                  <td className="px-5 py-3 text-xs">{iv.interviewerNames || "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/recruiting/candidates/${iv.candidateId}`} className="text-brand-600 inline-flex items-center text-xs hover:underline">
                      候補者へ<ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title={`✅ 完了・キャンセル（${past.length}件）`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-5 py-2 font-medium">日時</th>
              <th className="text-left px-5 py-2 font-medium">候補者</th>
              <th className="text-left px-5 py-2 font-medium">面接</th>
              <th className="text-left px-5 py-2 font-medium">結果</th>
              <th className="text-left px-5 py-2 font-medium">フィードバック</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {past.length === 0 && (
              <tr><td colSpan={5} className="text-center text-sm text-slate-400 py-6">履歴はありません</td></tr>
            )}
            {past.slice(0, 30).map((iv) => {
              const c = candById(iv.candidateId);
              return (
                <tr key={iv.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs">{fmtDt(iv.scheduledAt)}</td>
                  <td className="px-5 py-3 text-xs">{c ? `${c.flag} ${c.name}` : iv.candidateId}</td>
                  <td className="px-5 py-3"><Badge tone="slate" size="xs">{iv.round}</Badge></td>
                  <td className="px-5 py-3"><Badge tone={iv.result === "pass" ? "emerald" : iv.result === "fail" ? "rose" : iv.status === "cancelled" ? "slate" : "amber"} size="xs">
                    {iv.status === "cancelled" ? "キャンセル" : iv.result === "pass" ? "通過" : iv.result === "fail" ? "見送り" : iv.result === "hold" ? "保留" : iv.status}
                  </Badge></td>
                  <td className="px-5 py-3 text-xs text-slate-600 max-w-md truncate">{iv.feedback || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
