import { Card, CardHeader } from "@/components/ui";
import { auth } from "@/auth";
import { hasRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Forbidden } from "@/components/ui";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasRole(session, "group_admin")) return <Forbidden />;

  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 86400_000).toISOString();

  // DAU/MAU approximation from audit logs (auth.login.success entries)
  const audits: any[] = db.recentAudits(10000);
  const loginAudits = audits.filter((a) => a.action === "auth.login.success" && a.ts >= last30);
  const dailyMap = new Map<string, Set<string>>();
  for (const a of loginAudits) {
    const day = a.ts.slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, new Set());
    if (a.userId) dailyMap.get(day)!.add(a.userId);
  }
  const dauSeries = [...dailyMap.entries()].sort().map(([day, set]) => ({ day, count: set.size }));
  const mau = new Set(loginAudits.map((a) => a.userId).filter(Boolean)).size;
  const dauToday = dauSeries.find((d) => d.day === now.toISOString().slice(0, 10))?.count ?? 0;

  // Error rate (from audit log .failed actions)
  const errorAudits = audits.filter((a) => a.action.endsWith(".failed") || a.action.endsWith(".unauthorized") || a.action.endsWith(".rate_limited"));
  const errorByAction: Record<string, number> = {};
  for (const a of errorAudits.slice(0, 1000)) errorByAction[a.action] = (errorByAction[a.action] || 0) + 1;

  // Email delivery rate (last 100)
  const recentEmails: any[] = db.recentEmailLogs(200);
  const total = recentEmails.length;
  const delivered = recentEmails.filter((e) => e.status === "delivered" || e.status === "sent").length;
  const bounced = recentEmails.filter((e) => e.status === "bounced").length;
  const complained = recentEmails.filter((e) => e.status === "complained").length;
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  // API usage cost (last 30 days)
  const apiUsage: any[] = db.apiUsageSince(last30) as any[];
  const totalCostUsd = apiUsage.reduce((s, r) => s + (r.costUsd || 0), 0);
  const monthlyBudget = Number(process.env.AI_MONTHLY_BUDGET_USD || 100);
  const budgetPct = Math.round((totalCostUsd / monthlyBudget) * 100);

  return (
    <div className="space-y-6 max-w-6xl">
      <Card>
        <CardHeader title="📊 運用メトリクス" subtitle="DAU/MAU・エラー率・配信成功率・AIコスト" />
        <div className="grid md:grid-cols-4 gap-px bg-slate-100">
          <Metric label="本日アクティブユーザー" value={dauToday} sub="login.success 件数" tone="indigo" />
          <Metric label="月間アクティブユーザー" value={mau} sub="直近30日" tone="violet" />
          <Metric label="エラー / 拒否 件数" value={errorAudits.length} sub="auth/cron系" tone="rose" />
          <Metric label="メール配信成功率" value={`${deliveryRate}%`} sub={`${delivered}/${total}`} tone={deliveryRate >= 95 ? "emerald" : "amber"} />
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="🚨 エラー内訳" subtitle="直近1000件" />
          <div className="p-5 space-y-2">
            {Object.entries(errorByAction).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <code className="text-xs text-slate-600">{k}</code>
                <span className="font-bold text-rose-600">{v}</span>
              </div>
            ))}
            {Object.keys(errorByAction).length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">エラーはありません ✓</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="💰 AI APIコスト" subtitle={`予算 $${monthlyBudget}/月`} />
          <div className="p-5">
            <div className="text-3xl font-bold">${totalCostUsd.toFixed(2)}</div>
            <div className="mt-3 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${budgetPct >= 100 ? "bg-rose-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              予算の <span className={budgetPct >= 80 ? "text-amber-600 font-bold" : ""}>{budgetPct}%</span> を消化
              {budgetPct >= 100 && <span className="text-rose-600 font-bold ml-2">⚠️ 予算超過</span>}
            </p>
            <div className="mt-4 text-xs text-slate-600">
              リクエスト数: {apiUsage.length}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="📅 直近30日 ログイン推移 (DAU)" />
        <div className="p-5 overflow-x-auto">
          <div className="flex items-end gap-1 h-32 min-w-fit">
            {dauSeries.map((d) => (
              <div key={d.day} className="flex flex-col items-center gap-1">
                <div
                  className="w-4 bg-brand-500 rounded-t"
                  style={{ height: `${Math.max(2, (d.count / Math.max(1, mau)) * 100)}%` }}
                  title={`${d.day}: ${d.count}名`}
                />
                <div className="text-[9px] text-slate-400 -rotate-45 mt-2 whitespace-nowrap">{d.day.slice(5)}</div>
              </div>
            ))}
            {dauSeries.length === 0 && <p className="text-sm text-slate-500">ログインデータなし</p>}
          </div>
        </div>
      </Card>

      {(bounced > 0 || complained > 0) && (
        <Card>
          <CardHeader title="📬 メール配信問題" subtitle="バウンス + スパム報告" />
          <div className="p-5 grid grid-cols-2 gap-4">
            <Metric label="バウンス" value={bounced} sub="リトライ不可" tone="rose" />
            <Metric label="スパム報告" value={complained} sub="ユーザーがマーク" tone="amber" />
          </div>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: any; sub: string; tone: "indigo" | "violet" | "rose" | "amber" | "emerald" }) {
  const colors: any = {
    indigo: "text-indigo-600",
    violet: "text-violet-600",
    rose: "text-rose-600",
    amber: "text-amber-600",
    emerald: "text-emerald-600",
  };
  return (
    <div className="bg-white p-5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${colors[tone]}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
    </div>
  );
}
