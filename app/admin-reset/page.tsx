import AdminResetForm from "./form";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminResetPage() {
  const enabled = !!process.env.ADMIN_RESET_TOKEN;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
            <ShieldAlert className="text-rose-600" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">緊急パスワードリセット</h1>
            <p className="text-xs text-gray-500">初回ログイン・忘失時のみ使用</p>
          </div>
        </div>

        {!enabled ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-2">
            <div className="font-bold">🔒 リセット機能は無効です</div>
            <div>
              この画面を使うには、Fly.io ダッシュボードで以下を実施してください:
            </div>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>左サイドバー <strong>Secrets</strong> をクリック</li>
              <li><strong>New Secret</strong> ボタン</li>
              <li>Name: <code className="bg-white px-1 rounded">ADMIN_RESET_TOKEN</code></li>
              <li>Value: 自分で決めた任意の文字列 (16文字以上推奨)</li>
              <li><strong>Set Secret</strong> → 自動デプロイを待つ (~30秒)</li>
              <li>このページをリロード</li>
            </ol>
            <div className="text-xs text-amber-700 mt-2">
              ⚠️ リセット完了後は同じ手順で ADMIN_RESET_TOKEN を <strong>削除</strong> してください。残しておくと第三者に悪用される可能性があります。
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 mb-4">
              ADMIN_RESET_TOKEN が設定されています。下記フォームで管理者パスワードをリセットできます。
              <strong> 使用後は必ずダッシュボードからこの secret を削除してください。</strong>
            </div>
            <AdminResetForm />
          </>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
          <a href="/login" className="text-brand-600 hover:underline">← ログイン画面に戻る</a>
        </div>
      </div>
    </div>
  );
}
