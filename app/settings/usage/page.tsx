import { auth } from "@/auth";
import { hasRole } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardHeader, Badge } from "@/components/ui";
import UsageChart from "./chart";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasRole(session, "group_admin") && !hasRole(session, "auditor")) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
      </div>
    );
  }

  const since30 = new Date(); since30.setDate(since30.getDate() - 30);
  const since30iso = since30.toISOString();

  const allCalls: any[] = db.apiUsageSince(since30iso);
  const dailyByModel: any[] = db.apiUsageDailySince(since30iso);

  const totals = allCalls.reduce(
    (acc, c) => {
      acc.calls += 1;
      acc.success += c.status === "success" ? 1 : 0;
      acc.error += c.status === "error" ? 1 : 0;
      acc.mock += c.status === "mock" ? 1 : 0;
      acc.inputTokens += c.inputTokens || 0;
      acc.outputTokens += c.outputTokens || 0;
      acc.cacheRead += c.cacheReadTokens || 0;
      acc.cacheWrite += c.cacheCreationTokens || 0;
      acc.costUsd += c.costUsd || 0;
      return acc;
    },
    { calls: 0, success: 0, error: 0, mock: 0, inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 }
  );

  // Aggregate daily totals (sum across models per day) for the chart
  const dailyAgg = new Map<string, { day: string; cost: number; tokens: number }>();
  for (const r of dailyByModel) {
    const cur = dailyAgg.get(r.day) || { day: r.day, cost: 0, tokens: 0 };
    cur.cost += r.costUsd;
    cur.tokens += (r.inputTokens || 0) + (r.outputTokens || 0);
    dailyAgg.set(r.day, cur);
  }
  const dailyData = [...dailyAgg.values()].sort((a, b) => a.day.localeCompare(b.day));

  // Per-model summary
  const perModel = new Map<string, any>();
  for (const r of dailyByModel) {
    const cur = perModel.get(r.model) || { model: r.model, calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 };
    cur.calls += r.calls;
    cur.inputTokens += r.inputTokens || 0;
    cur.outputTokens += r.outputTokens || 0;
    cur.cacheReadTokens += r.cacheReadTokens || 0;
    cur.costUsd += r.costUsd;
    perModel.set(r.model, cur);
  }
  const modelRows = [...perModel.values()].sort((a, b) => b.costUsd - a.costUsd);

  // Cache hit rate
  const totalInputAndCache = totals.inputTokens + totals.cacheRead + totals.cacheWrite;
  const cacheHitRate = totalInputAndCache > 0 ? (totals.cacheRead / totalInputAndCache) * 100 : 0;
  const estSavingsUsd = totals.cacheRead > 0 ? (totals.cacheRead / 1_000_000) * 5.0 * 0.9 : 0;  // rough estimate at opus rate

  const fmtJpy = (usd: number) => `¥${Math.round(usd * 150).toLocaleString()}`;
  const fmtUsd = (usd: number) => `$${usd.toFixed(4)}`;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold">💰 Anthropic API 使用量</h1>
        <p className="text-xs text-slate-500 mt-1">直近 30日 ／ 履歴書解析 + 将来追加される AI機能</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="API 呼び出し" value={String(totals.calls)} sub={`success ${totals.success} / error ${totals.error} / mock ${totals.mock}`} />
        <KpiCard label="合計入力トークン" value={totals.inputTokens.toLocaleString()} sub={`+ キャッシュ ${totals.cacheRead.toLocaleString()}`} />
        <KpiCard label="合計出力トークン" value={totals.outputTokens.toLocaleString()} />
        <KpiCard
          label="推定コスト"
          value={fmtUsd(totals.costUsd)}
          sub={`≈ ${fmtJpy(totals.costUsd)}（@¥150/$）`}
          tone="emerald"
        />
      </div>

      {totals.cacheRead > 0 && (
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-2xl">🚀</span>
            <div>
              <div className="font-bold text-emerald-900">プロンプトキャッシュが効いています</div>
              <div className="text-xs text-emerald-800 mt-0.5">
                キャッシュヒット率：<b>{cacheHitRate.toFixed(1)}%</b> ／
                推定節約額：<b>{fmtUsd(estSavingsUsd)}</b>（フル価格との差分概算）
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="📈 日次コスト推移（直近30日）" subtitle="model に関わらず合算（モックは除外）" />
        <div className="p-4 h-64">
          <UsageChart data={dailyData.filter((d) => d.cost > 0)} />
          {dailyData.filter((d) => d.cost > 0).length === 0 && (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              まだ実 API コールがありません（ANTHROPIC_API_KEY を設定して履歴書解析を実行）
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="🤖 モデル別 内訳" />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-5 py-2 font-medium">モデル</th>
              <th className="text-right px-5 py-2 font-medium">呼び出し回数</th>
              <th className="text-right px-5 py-2 font-medium">入力トークン</th>
              <th className="text-right px-5 py-2 font-medium">出力トークン</th>
              <th className="text-right px-5 py-2 font-medium">キャッシュ読込</th>
              <th className="text-right px-5 py-2 font-medium">コスト (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {modelRows.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-400 py-8">まだ呼び出しがありません</td></tr>
            )}
            {modelRows.map((m) => (
              <tr key={m.model} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs">
                  {m.model === "mock" ? <Badge tone="slate">mock</Badge> : m.model}
                </td>
                <td className="px-5 py-3 text-right">{m.calls}</td>
                <td className="px-5 py-3 text-right font-mono">{(m.inputTokens || 0).toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-mono">{(m.outputTokens || 0).toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-mono text-emerald-700">{(m.cacheReadTokens || 0).toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-medium">{fmtUsd(m.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="🔍 直近の呼び出し（最新10件）" />
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium w-44">日時 (UTC)</th>
              <th className="text-left px-4 py-2 font-medium">機能</th>
              <th className="text-left px-4 py-2 font-medium">モデル</th>
              <th className="text-left px-4 py-2 font-medium">ユーザー</th>
              <th className="text-right px-4 py-2 font-medium">in / out</th>
              <th className="text-right px-4 py-2 font-medium">コスト</th>
              <th className="text-left px-4 py-2 font-medium">ステータス</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allCalls.slice(0, 10).map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-[10px]">{c.ts}</td>
                <td className="px-4 py-2"><Badge tone="indigo" size="xs">{c.feature}</Badge></td>
                <td className="px-4 py-2 font-mono text-[10px]">{c.model}</td>
                <td className="px-4 py-2">{c.userLogin || "—"}</td>
                <td className="px-4 py-2 text-right font-mono">{(c.inputTokens || 0).toLocaleString()} / {(c.outputTokens || 0).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{fmtUsd(c.costUsd)}</td>
                <td className="px-4 py-2">
                  <Badge tone={c.status === "success" ? "emerald" : c.status === "error" ? "rose" : "slate"} size="xs">{c.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, sub, tone = "slate" }: { label: string; value: string; sub?: string; tone?: "slate" | "emerald" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone === "emerald" ? "text-emerald-700" : "text-slate-800"}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </Card>
  );
}
