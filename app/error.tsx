"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Send to Sentry on the client (server-side errors are captured by Next's
    // Sentry SDK integration when SENTRY_DSN is set).
    if (typeof window !== "undefined" && (window as any).Sentry?.captureException) {
      (window as any).Sentry.captureException(error);
    }
    console.error("[client-error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl mb-2">⚠️</div>
        <h1 className="text-lg font-bold text-slate-800">エラーが発生しました</h1>
        <p className="text-sm text-slate-500 mt-2">
          一時的な問題の可能性があります。再読み込みしてもう一度お試しください。
        </p>
        {error.digest && (
          <p className="mt-3 text-xs font-mono text-slate-400">エラーID: {error.digest}</p>
        )}
        <div className="mt-6 flex gap-2 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm"
          >
            再試行
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm"
          >
            ダッシュボードへ
          </Link>
        </div>
      </div>
    </div>
  );
}
