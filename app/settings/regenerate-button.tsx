"use client";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { regenerateRemindersAction } from "@/lib/actions";

export default function RegenerateReminderButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onClick = () => {
    setErr(null); setInfo(null);
    start(async () => {
      try {
        const r = await regenerateRemindersAction();
        setInfo(`✅ ${r.generated}件生成・${r.removed}件削除（うち${r.updated}件は対応済み状態を保持）／ ${r.durationMs}ms`);
        router.refresh();
      } catch (e: any) {
        setErr(e?.message || "再生成に失敗しました");
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
      >
        <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
        {pending ? "再生成中..." : "リマインダーを今すぐ再生成"}
      </button>
      {info && <span className="text-xs text-emerald-700">{info}</span>}
      {err && <span className="text-xs text-rose-700">{err}</span>}
    </div>
  );
}
