"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Sentry?.captureException) {
      (window as any).Sentry.captureException(error);
    }
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui", margin: 0, padding: "4rem", background: "#f8fafc" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem", background: "white", borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>致命的エラー</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
            アプリケーションを再読み込みしてください。問題が続く場合は管理者へ連絡してください。
          </p>
          {error.digest && (
            <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", fontFamily: "monospace", color: "#94a3b8" }}>
              エラーID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem", padding: "0.5rem 1rem", background: "#6366f1", color: "white",
              border: "none", borderRadius: 6, cursor: "pointer",
            }}
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
