import { db } from "@/lib/db";
import { auth } from "@/auth";
import { hasRole } from "@/lib/permissions";
import { Card, CardHeader, Badge, Forbidden } from "@/components/ui";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const RANKS = ["S", "A+", "A", "B", "C", "D"] as const;
const TARGET_DIST: Record<string, number> = {
  S: 10, "A+": 15, A: 20, B: 35, C: 15, D: 5, // 目安 % per dept
};

export default async function CalibrationPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasRole(session, "group_admin") && !hasRole(session, "entity_hr") && !hasRole(session, "school_hr") && !hasRole(session, "principal")) {
    return <Forbidden message="評価会議は HR / 校長のみ" />;
  }

  // Pull all reviews currently in calibration or just past it
  const allReviews: any[] = [];
  const employees: any[] = db.employees() as any[];
  for (const e of employees) {
    const rs: any[] = db.reviewsByEmployee(e.id) as any[];
    for (const r of rs) {
      if (["calibration", "feedback", "finalized"].includes(r.workflowStatus)) {
        allReviews.push({ ...r, employee: e });
      }
    }
  }

  // Group by department for distribution analysis
  const byDept: Record<string, any[]> = {};
  for (const r of allReviews) {
    const key = r.employee.departmentId;
    (byDept[key] ||= []).push(r);
  }
  const departments: any[] = db.departments() as any[];
  const deptName = (id: string) => departments.find((d) => d.id === id)?.name || id;

  return (
    <div className="space-y-6 max-w-6xl">
      <Card>
        <CardHeader title="⚖️ 評価会議 (キャリブレーション)" subtitle="部門別の評価ランク分布調整" />
        <div className="p-5 text-sm text-slate-600">
          各部門の評価ランクが正規分布の目安 (S=10% / A+=15% / A=20% / B=35% / C=15% / D=5%) に近づくよう調整します。
          評価会議段階の評価のみ調整可能です (確定後は変更不可)。
        </div>
      </Card>

      {Object.keys(byDept).length === 0 && (
        <Card>
          <div className="p-12 text-center text-sm text-slate-500">
            評価会議段階の評価がありません。各社員プロフィールから「構造化評価を開始」→「二次評価完了」まで進めてください。
          </div>
        </Card>
      )}

      {Object.entries(byDept).map(([deptId, reviews]) => {
        const total = reviews.length;
        const dist: Record<string, number> = {};
        for (const r of reviews) {
          const rank = r.calibratedRank || r.computedRank || "—";
          dist[rank] = (dist[rank] || 0) + 1;
        }
        return (
          <Card key={deptId}>
            <CardHeader title={`📊 ${deptName(deptId)}`} subtitle={`対象: ${total} 名`} />
            <div className="p-5 space-y-3">
              {/* Distribution bars */}
              <div className="grid grid-cols-6 gap-2">
                {RANKS.map((rank) => {
                  const count = dist[rank] || 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const target = TARGET_DIST[rank];
                  const tone = pct > target + 10 ? "rose" : pct < target - 10 ? "amber" : "emerald";
                  const colors: any = { rose: "bg-rose-500", amber: "bg-amber-500", emerald: "bg-emerald-500" };
                  return (
                    <div key={rank}>
                      <div className="text-center text-xs font-bold mb-1">{rank}</div>
                      <div className="bg-slate-100 rounded h-20 flex items-end overflow-hidden">
                        <div className={`w-full ${colors[tone]} transition-all`} style={{ height: `${Math.max(2, pct)}%` }} />
                      </div>
                      <div className="text-center text-xs mt-1">
                        <span className="font-bold">{count}</span>
                        <span className="text-slate-400">/{pct}%</span>
                      </div>
                      <div className="text-center text-[10px] text-slate-400">目安 {target}%</div>
                    </div>
                  );
                })}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">氏名</th>
                      <th className="text-left px-3 py-2">種別</th>
                      <th className="text-left px-3 py-2">期間</th>
                      <th className="text-right px-3 py-2">スコア</th>
                      <th className="text-center px-3 py-2">仮ランク</th>
                      <th className="text-center px-3 py-2">確定ランク</th>
                      <th className="text-center px-3 py-2">ステータス</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reviews.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{r.employee.flag} {r.employee.name}</td>
                        <td className="px-3 py-2">{r.type}</td>
                        <td className="px-3 py-2 text-slate-500">{r.periodLabel}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.computedScore != null ? r.computedScore.toFixed(2) : "—"}</td>
                        <td className="px-3 py-2 text-center"><Badge tone="violet" size="xs">{r.computedRank || "—"}</Badge></td>
                        <td className="px-3 py-2 text-center">{r.calibratedRank ? <Badge tone="emerald" size="xs">{r.calibratedRank}</Badge> : <span className="text-slate-300">未調整</span>}</td>
                        <td className="px-3 py-2 text-center text-slate-500">{r.workflowStatus}</td>
                        <td className="px-3 py-2 text-right">
                          <Link href={`/performance/profiles/${r.employee.id}/review/${r.id}`} className="text-brand-600 hover:underline inline-flex items-center text-xs">
                            開く<ChevronRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
