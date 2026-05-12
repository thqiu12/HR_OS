"use client";

import { useState } from "react";
import { changeMyPasswordAction } from "@/lib/account-actions";

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { kind: "ok" }
    | { kind: "err"; msg: string }
    | null
  >(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    if (next !== confirm) {
      setResult({ kind: "err", msg: "新しいパスワードと確認用の入力が一致しません" });
      return;
    }
    if (next.length < 12) {
      setResult({ kind: "err", msg: "新しいパスワードは 12 文字以上で指定してください" });
      return;
    }

    setBusy(true);
    try {
      const r = await changeMyPasswordAction({ currentPassword: current, newPassword: next });
      if (r.ok === true) {
        setResult({ kind: "ok" });
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setResult({ kind: "err", msg: r.error });
      }
    } catch (e: any) {
      setResult({ kind: "err", msg: e?.message || "不明なエラー" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">現在のパスワード</label>
        <input
          type={show ? "text" : "password"}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          新しいパスワード <span className="text-slate-400 font-normal">(12文字以上)</span>
        </label>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            required
            minLength={12}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700"
          >
            {show ? "隠す" : "表示"}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">新しいパスワード(確認)</label>
        <input
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          required
          minLength={12}
        />
      </div>

      {result?.kind === "ok" && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
          ✅ パスワードを変更しました
        </div>
      )}
      {result?.kind === "err" && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-900">
          {result.msg}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition"
      >
        {busy ? "更新中..." : "パスワードを変更"}
      </button>
    </form>
  );
}
