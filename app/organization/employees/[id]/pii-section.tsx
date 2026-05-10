"use client";
import { Card, CardHeader, Badge } from "@/components/ui";
import { useState, useTransition } from "react";
import { Lock, Eye, Edit2, X, Save, AlertTriangle } from "lucide-react";
import { setEmployeePiiAction, decryptEmployeePiiAction } from "./pii-actions";
import { useRouter } from "next/navigation";

const FIELDS = [
  { key: "myNumber" as const, label: "マイナンバー", placeholder: "1234-5678-9012" },
  { key: "bankAccount" as const, label: "給与振込口座", placeholder: "三菱UFJ・新宿・普通・1234567" },
  { key: "passportNo" as const, label: "パスポート番号", placeholder: "TZ1234567" },
];

export default function EmployeePiiSection({ employeeId, hasMyNumber, hasBank, hasPassport }: {
  employeeId: string; hasMyNumber: boolean; hasBank: boolean; hasPassport: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [revealed, setRevealed] = useState<Record<string, string | null>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const present: Record<string, boolean> = { myNumber: hasMyNumber, bankAccount: hasBank, passportNo: hasPassport };

  const reveal = (key: any) => {
    setErr(null);
    start(async () => {
      const r = await decryptEmployeePiiAction(employeeId, key);
      if (r.ok) {
        setRevealed((p) => ({ ...p, [key]: r.plaintext }));
        // Auto-hide after 15 seconds
        setTimeout(() => setRevealed((p) => ({ ...p, [key]: null })), 15000);
      } else { setErr(r.error); }
    });
  };

  const save = (key: any) => {
    setErr(null);
    start(async () => {
      try {
        await setEmployeePiiAction(employeeId, { [key]: editValue });
        setEditing(null); setEditValue("");
        router.refresh();
      } catch (e: any) { setErr(e?.message || "保存に失敗"); }
    });
  };

  return (
    <Card>
      <CardHeader
        title="🔐 暗号化 PII"
        subtitle="AES-256-GCM 暗号化（at rest）／ 表示・編集はグループ管理者のみ／ アクセスは監査ログに記録"
        right={<Badge tone="rose"><Lock size={11} className="inline mr-1" />admin only</Badge>}
      />
      <div className="p-5 space-y-3">
        {err && (
          <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-lg flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />{err}
          </div>
        )}
        {FIELDS.map((f) => {
          const has = present[f.key];
          const value = revealed[f.key];
          const isEditing = editing === f.key;
          return (
            <div key={f.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="flex-1">
                <div className="text-xs text-slate-500">{f.label}</div>
                <div className="font-mono text-sm mt-0.5">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full px-2 py-1 border border-slate-200 rounded font-mono"
                    />
                  ) : value ? (
                    <span className="text-emerald-700">{value}</span>
                  ) : has ? (
                    <span className="text-slate-400">●●●●●●●●（暗号化保存済み）</span>
                  ) : (
                    <span className="text-slate-400">未設定</span>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => save(f.key)} disabled={pending} className="text-emerald-600 hover:bg-emerald-50 rounded p-1.5">
                    <Save size={14} />
                  </button>
                  <button onClick={() => { setEditing(null); setEditValue(""); }} className="text-slate-400 hover:bg-slate-100 rounded p-1.5">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  {has && !value && (
                    <button onClick={() => reveal(f.key)} disabled={pending} className="text-blue-600 hover:bg-blue-50 rounded p-1.5" title="復号して表示（15秒で自動非表示）">
                      <Eye size={14} />
                    </button>
                  )}
                  <button onClick={() => { setEditing(f.key); setEditValue(""); }} className="text-slate-500 hover:bg-slate-100 rounded p-1.5" title={has ? "更新" : "登録"}>
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <p className="text-[11px] text-slate-500 leading-relaxed">
          💡 復号操作はすべて監査ログに記録されます。表示は15秒後に自動的に非表示になります。
          <br />
          鍵は <code className="bg-slate-100 px-1 rounded">ENCRYPTION_KEY</code> 環境変数（未設定時 <code className="bg-slate-100 px-1 rounded">AUTH_SECRET</code> から派生）。
        </p>
      </div>
    </Card>
  );
}
