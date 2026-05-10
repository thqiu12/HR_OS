"use client";
import { useState, useTransition } from "react";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { loginAction, ssoSignInAction } from "./actions";

export default function LoginForm({ callbackUrl, error, ssoGoogle, ssoAzure }: { callbackUrl?: string; error?: string; ssoGoogle?: boolean; ssoAzure?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [loginId, setLoginId] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [err, setErr] = useState<string | null>(error ? "ログインに失敗しました" : null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await loginAction({ loginId, password, otp, callbackUrl });
      if (res?.error) {
        setErr(res.error);
        // First-time fail with empty OTP → show the OTP field on retry
        if (!showOtp && !otp) setShowOtp(true);
        return;
      }
      router.push(res?.redirect || "/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label className="text-xs text-slate-500 font-medium">ログインID</label>
        <input
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 font-medium">パスワード</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>
      {showOtp && (
        <div>
          <label className="text-xs text-slate-500 font-medium">2FA 認証コード（6桁）</label>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="123456"
            className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <p className="text-[10px] text-slate-400 mt-1">Authenticator アプリの現在のコードを入力してください</p>
        </div>
      )}
      {err && (
        <div className="text-xs bg-rose-50 text-rose-700 p-3 rounded-lg">{err}</div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium disabled:opacity-60"
      >
        {pending ? "ログイン中..." : (<><LogIn size={16} />ログイン</>)}
      </button>

      {(ssoGoogle || ssoAzure) && (
        <>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-xs text-slate-400">または SSO で</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>
          {ssoGoogle && (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => { await ssoSignInAction("google"); })}
              className="w-full inline-flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg font-medium text-sm disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 18 18"><path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285f4"/><path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" fill="#34a853"/><path d="M4.5 10.48a4.8 4.8 0 0 1 0-3.06V5.35H1.83a8 8 0 0 0 0 7.2L4.5 10.48z" fill="#fbbc05"/><path d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.35L4.5 7.42a4.77 4.77 0 0 1 4.48-3.24z" fill="#ea4335"/></svg>
              Google でログイン
            </button>
          )}
          {ssoAzure && (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => { await ssoSignInAction("microsoft-entra-id"); })}
              className="w-full inline-flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg font-medium text-sm disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 23 23"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
              Microsoft で続ける
            </button>
          )}
        </>
      )}

      <div className="text-xs text-slate-400 text-center pt-2">
        © 2026 さくらホールディングス HR OS
      </div>
    </form>
  );
}
