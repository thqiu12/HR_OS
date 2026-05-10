import LoginForm from "./form";
import { GraduationCap } from "lucide-react";

export default function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string; error?: string } }) {
  const ssoGoogle = !!process.env.GOOGLE_CLIENT_ID;
  const ssoAzure = !!process.env.AZURE_AD_CLIENT_ID;
  const ssoError = searchParams.error === "sso_unknown_user"
    ? "SSO ログインしましたが、このメールアドレスでは HR OS にユーザーが登録されていません。管理者に連絡してください。"
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid md:grid-cols-2 bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-brand-600 to-indigo-700 text-white">
          <div>
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <GraduationCap size={24} />
            </div>
            <h1 className="text-2xl font-bold mt-6">HR OS</h1>
            <p className="text-sm opacity-90 mt-2">グループ統合人事システム</p>
            <p className="text-xs opacity-75 mt-1">
              学校法人・株式会社・日本語学校・専門学校・私塾の<br />
              採用 / 入社 / 組織 / 評価を一元管理
            </p>
          </div>
          <div className="text-xs opacity-80 space-y-1.5">
            <div className="font-bold opacity-100 mb-2">🧪 デモアカウント</div>
            {[
              ["admin / admin123", "グループ管理者（全データ）"],
              ["hr-entity / hr123", "法人HR（s1+s2）"],
              ["hr-s1 / hr123", "学校HR（s1のみ）"],
              ["principal-s1 / pri123", "校長 + 教務部長"],
              ["manager-s2 / mgr123", "日本語学科 部門長"],
              ["tanaka / emp123", "一般社員（自分のみ）"],
            ].map(([id, role]) => (
              <div key={id} className="flex justify-between gap-3">
                <code className="opacity-90">{id}</code>
                <span className="opacity-75">{role}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-10">
          <h2 className="text-xl font-bold">ログイン</h2>
          <p className="text-sm text-slate-500 mt-1">アカウント情報を入力してください</p>
          {ssoError && (
            <div className="mt-4 bg-rose-50 text-rose-700 text-xs p-3 rounded-lg">{ssoError}</div>
          )}
          <LoginForm callbackUrl={searchParams.callbackUrl} error={searchParams.error} ssoGoogle={ssoGoogle} ssoAzure={ssoAzure} />
        </div>
      </div>
    </div>
  );
}
