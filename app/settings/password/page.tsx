import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardHeader } from "@/components/ui";
import ChangePasswordForm from "./form";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/settings" className="hover:underline">設定</Link>
        <span className="mx-1">/</span>
        <span>パスワード変更</span>
      </div>

      <Card>
        <CardHeader
          title="🔑 パスワード変更"
          subtitle={`ログイン中のアカウント (${session.user?.name || session.user?.email}) のパスワードを変更します。`}
        />
        <div className="p-6">
          <ChangePasswordForm />
        </div>
      </Card>

      <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg p-4">
        <div className="font-medium text-slate-700 mb-1">💡 パスワード運用のヒント</div>
        <ul className="list-disc list-inside space-y-1">
          <li>12 文字以上、英数記号を組み合わせたものを推奨</li>
          <li>使い回しは厳禁(別サービスで漏洩した場合に芋づる式被害)</li>
          <li>変更後は全セッションが無効化されることがあります(必要に応じて再ログイン)</li>
          <li>2FA を併用するとさらに安全 → <Link href="/settings/2fa" className="text-brand-600 hover:underline">2FA 設定</Link></li>
        </ul>
      </div>
    </div>
  );
}
