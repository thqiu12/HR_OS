import { Card, CardHeader, Badge } from "@/components/ui";
import { Shield, Users, FileText, Bell, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { hasRole } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import RegenerateReminderButton from "./regenerate-button";

export const dynamic = "force-dynamic";

const roles = [
  { name: "グループ管理者", scope: "全法人", count: 2, perms: "全モジュール CRUD・マスタ管理" },
  { name: "法人HR管理者", scope: "学校法人さくら学園", count: 3, perms: "法人内すべて" },
  { name: "学校HR担当", scope: "学校単位", count: 8, perms: "自校採用・入社・組織編集" },
  { name: "校長 / 学校長", scope: "自校", count: 4, perms: "自校全データ閲覧・評価承認" },
  { name: "部門長", scope: "自部門 + 兼任先", count: 12, perms: "部下情報・評価入力" },
  { name: "一般社員", scope: "自分のみ", count: 380, perms: "自分の情報閲覧・述職書提出" },
  { name: "内定者ポータル", scope: "自身の入社案件のみ", count: 5, perms: "個人情報入力・書類提出" },
  { name: "経営層", scope: "全社", count: 4, perms: "ダッシュボード閲覧のみ" },
  { name: "監査", scope: "全社", count: 1, perms: "監査ログ閲覧・データエクスポート" },
];

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasRole(session, "group_admin")) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
        <p className="text-sm text-slate-500 mt-2">設定画面はグループ管理者のみアクセスできます。</p>
      </div>
    );
  }
  // Real stats from DB
  const userCount = db.allUsers().length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const auditCount = db.auditCountSince(monthStart.toISOString());
  const recent: any[] = db.recentAudits(8);
  const lastGen: any = db.latestReminderGeneratorRun();

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard icon={<Users size={18} />} label="登録ユーザー" value={String(userCount)} />
        <StatCard icon={<Shield size={18} />} label="ロール定義" value="9" />
        <StatCard icon={<FileText size={18} />} label="今月の監査ログ" value={auditCount.toLocaleString()} href="/settings/audit" />
        <StatCard icon={<Bell size={18} />} label="API 使用量" value="ダッシュボード" href="/settings/usage" />
      </div>

      <Card>
        <CardHeader
          title="🛡 直近の監査ログ"
          subtitle="ユーザー操作とPIIアクセスの記録（直近8件）"
          right={<Link href="/settings/audit" className="text-xs text-brand-600 hover:underline">すべて見る →</Link>}
        />
        <div className="divide-y divide-slate-100">
          {recent.length === 0 && <div className="p-4 text-xs text-slate-400 text-center">まだ監査ログがありません</div>}
          {recent.map((l: any) => (
            <div key={l.id} className="p-3 px-5 flex items-center gap-3 text-xs">
              <span className="font-mono text-[10px] text-slate-500 w-44">{l.ts}</span>
              <span className="font-medium w-24 truncate">{l.userLogin || "—"}</span>
              <Badge tone={l.action.endsWith("denied") || l.action.includes("failed") ? "rose" : "indigo"}>{l.action}</Badge>
              <span className="text-slate-500 truncate">{l.resourceType ? `${l.resourceType}/${l.resourceId}` : ""}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="🔁 リマインダー自動生成"
          subtitle="在留カード期限・試用期間・契約終了・書類未提出/差戻しを実データから生成"
        />
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-slate-500">最終生成</div>
              <div className="font-mono text-[11px] mt-1">{lastGen?.ranAt?.slice(0, 19).replace("T", " ") || "未実行"}</div>
              {lastGen && <div className="text-slate-400 text-[10px] mt-0.5">by {lastGen.ranBy}</div>}
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-slate-500">生成件数 / 削除件数</div>
              <div className="font-medium mt-1">
                {lastGen ? `${lastGen.generatedCount} / ${lastGen.removedCount}` : "—"}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-slate-500">所要時間</div>
              <div className="font-medium mt-1">{lastGen ? `${lastGen.durationMs} ms` : "—"}</div>
            </div>
          </div>

          <RegenerateReminderButton />

          <div className="text-xs text-slate-500 leading-relaxed">
            💡 本番では cron で毎時 <code className="bg-slate-100 px-1 rounded">/api/cron/reminders</code> を叩くことを推奨。
            ボタン操作は手動で再生成したい場合のみ。<br />
            対応済み（handled_at）状態は dedup_key で自動的に保持されます。
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="🛡 ロール & 権限スコープ" subtitle="RBAC + Scope（学校・部門単位）で柔軟に制御" />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-5 py-2 font-medium">ロール</th>
              <th className="text-left px-5 py-2 font-medium">スコープ</th>
              <th className="text-left px-5 py-2 font-medium">人数</th>
              <th className="text-left px-5 py-2 font-medium">権限</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roles.map((r) => (
              <tr key={r.name} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium">{r.name}</td>
                <td className="px-5 py-3"><Badge tone="indigo">{r.scope}</Badge></td>
                <td className="px-5 py-3 text-slate-700">{r.count}名</td>
                <td className="px-5 py-3 text-xs text-slate-600">{r.perms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="🔐 セキュリティ設定" />
        <div className="p-5 space-y-3 text-sm">
          <SettingRow title="マイナンバー / 銀行口座 暗号化" desc="AES-256 で保管、専用権限のみ復号可能" status="有効" tone="emerald" />
          <SettingRow title="グループ管理者 / 法人HR は MFA 必須" desc="TOTP 認証アプリ" status="有効" tone="emerald" />
          <SettingRow title="PII アクセスログ強制記録" desc="マイナンバー・在留情報の閲覧をすべて監査ログに記録" status="有効" tone="emerald" />
          <SettingRow title="内定者ポータルリンク有効期限" desc="発行から 30日で自動失効" status="30日" tone="indigo" />
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const inner = (
    <Card className="p-4 flex items-center gap-3 h-full">
      <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">{icon}</div>
      <div className="flex-1">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
      {href && <ChevronRight size={16} className="text-slate-300" />}
    </Card>
  );
  return href ? <Link href={href} className="block hover:opacity-80 transition-opacity">{inner}</Link> : inner;
}

function SettingRow({ title, desc, status, tone }: { title: string; desc: string; status: string; tone: any }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      <Badge tone={tone}>{status}</Badge>
    </div>
  );
}
