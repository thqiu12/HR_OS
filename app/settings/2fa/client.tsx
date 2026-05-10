"use client";
import { useState, useTransition } from "react";
import { Shield, ShieldCheck, ShieldOff, Copy } from "lucide-react";
import { start2faSetupAction, confirm2faSetupAction, disable2faAction } from "@/lib/totp-actions";

export default function TwoFactorClient({ enabled, enabledAt }: { enabled: boolean; enabledAt: string | null }) {
  const [pending, start] = useTransition();
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(enabled);

  const begin = () => {
    setErr(null); setInfo(null);
    start(async () => {
      const r = await start2faSetupAction();
      setSecret(r.secret);
      setUri(r.uri);
    });
  };

  const confirm = () => {
    if (!secret || code.length !== 6) return;
    setErr(null);
    start(async () => {
      const r = await confirm2faSetupAction(secret, code);
      if (!r.ok) { setErr(r.error); return; }
      setConfirmed(true);
      setInfo("✅ 2FA を有効化しました");
      setSecret(null); setUri(null); setCode("");
    });
  };

  const disable = () => {
    if (code.length !== 6) { setErr("現在の6桁コードを入力してください"); return; }
    if (!confirm0("2FA を無効化しますか?")) return;
    setErr(null);
    start(async () => {
      const r = await disable2faAction(code);
      if (!r.ok) { setErr(r.error); return; }
      setConfirmed(false);
      setInfo("2FA を無効化しました");
      setCode("");
    });
  };

  if (confirmed) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3 bg-emerald-50 text-emerald-800 p-4 rounded-lg">
          <ShieldCheck size={24} />
          <div>
            <div className="font-medium">2FA は有効です</div>
            {enabledAt && <div className="text-xs">有効化: {new Date(enabledAt).toLocaleString("ja-JP")}</div>}
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium">無効化するには現在のコードを入力</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="123456"
            className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono tracking-widest text-center"
          />
        </div>
        {err && <div className="text-xs bg-rose-50 text-rose-700 p-3 rounded-lg">{err}</div>}
        {info && <div className="text-xs bg-emerald-50 text-emerald-700 p-3 rounded-lg">{info}</div>}
        <button
          onClick={disable}
          disabled={pending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 disabled:opacity-60"
        >
          <ShieldOff size={14} />2FA を無効化
        </button>
      </div>
    );
  }

  if (!secret) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3 bg-slate-50 text-slate-600 p-4 rounded-lg">
          <Shield size={24} />
          <div>
            <div className="font-medium">2FA は無効です</div>
            <div className="text-xs">Authenticator アプリ (Google Authenticator / Authy / 1Password 等) を準備してください。</div>
          </div>
        </div>
        {info && <div className="text-xs bg-emerald-50 text-emerald-700 p-3 rounded-lg">{info}</div>}
        <button
          onClick={begin}
          disabled={pending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
        >
          <Shield size={14} />2FA を有効化
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="text-sm">
        <p>1. Authenticator アプリで下記の <strong>シークレット</strong> を手入力するか、URI を QR 化して読み取ってください。</p>
      </div>
      <div>
        <label className="text-xs text-slate-500 font-medium">シークレット (Base32)</label>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono break-all">{secret}</code>
          <button onClick={() => navigator.clipboard.writeText(secret)} className="p-2 text-slate-500 hover:bg-slate-100 rounded">
            <Copy size={14} />
          </button>
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500 font-medium">プロビジョニング URI</label>
        <code className="block mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono break-all">{uri}</code>
        <p className="text-[10px] text-slate-400 mt-1">QR コードリーダ (qrcode-svg / qr-code-styling 等) でこの URI をエンコードして読ませると、ペアリングが一瞬で完了します。</p>
      </div>
      <div>
        <p className="text-sm">2. アプリに表示された <strong>6桁コード</strong> を入力してペアリングを確定してください。</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="123456"
          className="mt-2 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono tracking-widest text-center"
        />
      </div>
      {err && <div className="text-xs bg-rose-50 text-rose-700 p-3 rounded-lg">{err}</div>}
      <div className="flex gap-2">
        <button
          onClick={() => { setSecret(null); setUri(null); setCode(""); }}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm"
        >
          キャンセル
        </button>
        <button
          onClick={confirm}
          disabled={pending || code.length !== 6}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
        >
          <ShieldCheck size={14} />確定して有効化
        </button>
      </div>
    </div>
  );
}

// confirm() name conflict workaround
function confirm0(s: string) { return typeof window !== "undefined" && window.confirm(s); }
