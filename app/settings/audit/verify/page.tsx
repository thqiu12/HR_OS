import { auth } from "@/auth";
import { hasRole } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import Link from "next/link";

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

  const result = db.verifyAuditChain();
  await logAudit({
    session,
    action: "audit.chain.verified",
    after: result,
  });

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/settings/audit" className="text-sm text-brand-600 hover:underline">← 監査ログ一覧へ</Link>
      <div className="bg-white rounded-2xl shadow-card p-8">
        <div className="text-5xl text-center">{result.ok ? "✅" : "❌"}</div>
        <h1 className="text-xl font-bold text-center mt-3">
          {result.ok ? "監査ログ整合性 OK" : "改ざんを検出しました"}
        </h1>

        {result.ok ? (
          <div className="mt-6 space-y-3 text-sm">
            <Row label="検証結果" value={<span className="text-emerald-700 font-medium">改ざんなし</span>} />
            <Row label="検証件数" value={`${result.count} 件`} />
            <Row label="ハッシュアルゴリズム" value="SHA-256（前ハッシュチェーン）" />
            <Row label="トリガー保護" value="UPDATE / DELETE 不可（DBレベル）" />
            <Row label="先頭ハッシュ (head)" value={<code className="text-xs">{result.headHash.slice(0, 32)}…</code>} />
          </div>
        ) : (
          <div className="mt-6 space-y-3 text-sm">
            <Row label="破損位置" value={<code>id = {result.brokenAt}</code>} />
            <Row label="原因" value={<span className="text-rose-700">{result.reason}</span>} />
            <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-lg mt-4">
              監査ログのハッシュチェーンが切れています。<br />
              SQLiteファイルが直接編集されたか、トリガーが無効化されている可能性があります。
            </p>
          </div>
        )}

        <div className="mt-8 p-4 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed">
          <div className="font-bold mb-1">🔒 整合性保証の仕組み</div>
          <ul className="list-disc list-inside space-y-0.5">
            <li>各監査ログ行に <code>prev_hash</code> + <code>row_hash</code> を保存</li>
            <li><code>row_hash = SHA-256(行内容 + 前行の row_hash)</code></li>
            <li>SQLiteトリガーが <code>UPDATE</code> / <code>DELETE</code> を物理的にブロック</li>
            <li>1行でも書き換えれば、それ以降のハッシュが全て不一致になり検出される</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
