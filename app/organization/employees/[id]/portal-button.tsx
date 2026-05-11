"use client";
import { useState, useTransition } from "react";
import { Link2, Copy, Check } from "lucide-react";
import { issueTeacherPortalUrlAction } from "@/lib/teacher-portal-actions";

export default function TeacherPortalButton({ employeeId }: { employeeId: string }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const issue = () => {
    setErr(null); setCopied(false);
    start(async () => {
      try {
        const r = await issueTeacherPortalUrlAction(employeeId);
        setUrl(r.url);
      } catch (e: any) { setErr(e?.message || "発行失敗"); }
    });
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="space-y-2">
      {!url ? (
        <button onClick={issue} disabled={pending}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1 disabled:opacity-60">
          <Link2 size={12} />教員ポータルURLを発行 (90日)
        </button>
      ) : (
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-500">この URL を教員にメール / Slack / 印刷で共有してください (ログイン不要、自分のシフト・給与閲覧)</div>
          <div className="flex items-center gap-2">
            <input value={url} readOnly className="flex-1 px-2 py-1 border border-slate-200 rounded text-[10px] font-mono bg-slate-50" />
            <button onClick={copy} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded">
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      )}
      {err && <div className="text-xs text-rose-600">{err}</div>}
    </div>
  );
}
