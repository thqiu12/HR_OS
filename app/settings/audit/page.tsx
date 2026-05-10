import { db } from "@/lib/db";
import { auth } from "@/auth";
import { hasRole } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { Card, CardHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const actionTone: Record<string, any> = {
  "auth.login.success": "emerald",
  "auth.login.failed": "rose",
  "auth.logout": "slate",
  "candidate.move_stage": "indigo",
  "candidate.move_stage.denied": "rose",
  "onboarding.set_doc": "indigo",
  "onboarding.set_doc.denied": "rose",
  "onboarding.case.view": "blue",
  "onboarding.case.view.denied": "rose",
  "employee.view": "blue",
  "employee.pii.view": "amber",
  "employee.view.denied": "rose",
  "performance.profile.view": "blue",
  "performance.profile.view.denied": "rose",
  "invite.issued": "violet",
  "invite.used": "violet",
  "invite.verify.failed": "rose",
};

export default async function Page({ searchParams }: { searchParams: { action?: string; user?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasRole(session, "group_admin") && !hasRole(session, "auditor")) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
        <p className="text-sm text-slate-500 mt-2">監査ログはグループ管理者または監査ロールのみ閲覧可能です。</p>
      </div>
    );
  }

  const logs: any[] = db.auditSearch({ action: searchParams.action, userId: searchParams.user, limit: 200 });

  return (
    <div className="space-y-4 max-w-7xl">
      <Card>
        <CardHeader
          title="🛡 監査ログ"
          subtitle={`直近 ${logs.length}件 ／ フィルタ：${searchParams.action || "全アクション"}`}
          right={
            <a href="/settings/audit/verify" className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-md hover:bg-brand-700">
              整合性を検証
            </a>
          }
        />
        <form className="px-5 py-3 flex items-center gap-2 text-sm border-b border-slate-100 bg-slate-50">
          <span className="text-slate-500 text-xs">アクション絞り込み：</span>
          <input
            name="action"
            defaultValue={searchParams.action || ""}
            placeholder="例: candidate / login / onboarding"
            className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs w-72"
          />
          <input
            name="user"
            defaultValue={searchParams.user || ""}
            placeholder="ユーザーID"
            className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs w-40"
          />
          <button type="submit" className="px-3 py-1.5 rounded-md bg-brand-600 text-white text-xs">適用</button>
          <a href="/settings/audit" className="text-xs text-slate-500 hover:underline">クリア</a>
        </form>

        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium w-44">日時 (UTC)</th>
              <th className="text-left px-4 py-2 font-medium w-32">ユーザー</th>
              <th className="text-left px-4 py-2 font-medium">アクション</th>
              <th className="text-left px-4 py-2 font-medium">対象</th>
              <th className="text-left px-4 py-2 font-medium w-32">理由</th>
              <th className="text-left px-4 py-2 font-medium">変更内容</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-400 py-8">該当する監査ログがありません</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-[10px] text-slate-600">{l.ts}</td>
                <td className="px-4 py-2">{l.userLogin || <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-2"><Badge tone={actionTone[l.action] || "slate"}>{l.action}</Badge></td>
                <td className="px-4 py-2 text-slate-600">
                  {l.resourceType ? (
                    <>
                      <span className="text-[10px] text-slate-400">{l.resourceType}/</span>
                      <span className="font-mono">{l.resourceId}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-rose-600 text-[11px]">{l.reason || ""}</td>
                <td className="px-4 py-2 font-mono text-[10px] text-slate-500 max-w-md truncate" title={`${l.beforeValue || ""} → ${l.afterValue || ""}`}>
                  {l.beforeValue && <span className="text-rose-500">{l.beforeValue}</span>}
                  {l.beforeValue && l.afterValue && " → "}
                  {l.afterValue && <span className="text-emerald-600">{l.afterValue}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
