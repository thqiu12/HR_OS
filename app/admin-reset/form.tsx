"use client";

import { useState } from "react";
import { resetAdminPasswordAction } from "@/lib/admin-reset-action";

export default function AdminResetForm() {
  const [loginId, setLoginId] = useState("admin");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { kind: "ok" }
    | { kind: "err"; msg: string }
    | null
  >(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    if (newPassword !== confirm) {
      setResult({ kind: "err", msg: "パスワードと確認用の入力が一致しません" });
      return;
    }
    if (newPassword.length < 12) {
      setResult({ kind: "err", msg: "パスワードは 12 文字以上で指定してください" });
      return;
    }
    if (!token) {
      setResult({ kind: "err", msg: "リセットトークンを入力してください" });
      return;
    }

    setBusy(true);
    try {
      const r = await resetAdminPasswordAction({ token, loginId, newPassword });
      if (r.ok === true) {
        setResult({ kind: "ok" });
      } else {
        setResult({ kind: "err", msg: r.error });
      }
    } catch (e: any) {
      setResult({ kind: "err", msg: e?.message || "不明なエラー" });
    } finally {
      setBusy(false);
    }
  }

  if (result?.kind === "ok") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-900">
          <div className="font-bold mb-2">✅ パスワードを更新しました</div>
          <div>
            ログインID <code className="bg-white px-1 rounded">{loginId}</code> のパスワードを変更しました。下のボタンからログインしてください。
          </div>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          ⚠️ 必ず Fly.io ダッシュボードに戻って <strong>ADMIN_RESET_TOKEN</strong> を削除してください(残すと第三者にも使われる可能性)。
        </div>
        <a
          href="/login"
          className="block text-center bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg transition"
        >
          ログイン画面へ
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">ログインID</label>
        <input
          type="text"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          autoComplete="username"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          新しいパスワード <span className="text-gray-400">(12文字以上)</span>
        </label>
        <div className="relative">
          <input
            type={showPwd ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            required
            minLength={12}
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
          >
            {showPwd ? "隠す" : "表示"}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">新しいパスワード(確認)</label>
        <input
          type={showPwd ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          required
          minLength={12}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          リセットトークン <span className="text-gray-400">(ADMIN_RESET_TOKEN の値)</span>
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          required
        />
      </div>

      {result?.kind === "err" && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-900">
          {result.msg}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg transition"
      >
        {busy ? "更新中..." : "パスワードを更新"}
      </button>
    </form>
  );
}
