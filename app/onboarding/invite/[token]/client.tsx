"use client";
import { useRef, useState, useTransition } from "react";
import { Upload, Check, AlertCircle, GraduationCap, FileText } from "lucide-react";
import clsx from "clsx";
import { uploadDocViaInvite } from "./actions";

type DocRow = { code: string; name: string; status: string; required: boolean; rejectReason?: string | null };

export default function InvitePortal({
  token,
  jti,
  expiresAt,
  caseData,
}: {
  token: string;
  jti: string;
  expiresAt: string;
  caseData: {
    id: string;
    candidateName: string;
    flag: string;
    schoolName: string;
    position: string;
    route: string;
    expectedJoinDate: string;
    docs: DocRow[];
  };
}) {
  const [docs, setDocs] = useState<DocRow[]>(caseData.docs);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [pendingDoc, setPendingDoc] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const done = docs.filter((d) => d.status === "完了").length;
  const progress = Math.round((done / docs.length) * 100);

  const helpFor: Record<string, string | undefined> = {
    zairyu_card: "外国籍の方のみ。スマホで両面を鮮明に撮影してください。",
    mynumber_card: "マイナンバーカード未取得の方は、マイナンバー記載の住民票をご提出ください。",
    bank_card: "ご本人名義の口座のみ。表面・裏面ともに必要です。",
    rishoku_shomei: "前職から発行された離職証明書",
    gensen_choshu: "本年度分（複数社の場合は全て）",
  };

  const onSelect = (code: string, file: File | null) => {
    if (!file) return;
    setErr(null);
    setPendingDoc(code);
    const fd = new FormData();
    fd.set("token", token);
    fd.set("docCode", code);
    fd.set("file", file);
    start(async () => {
      const res = await uploadDocViaInvite(fd);
      setPendingDoc(null);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      // Optimistically update local state — server-side it's now 提出済
      setDocs((prev) => prev.map((d) => (d.code === code ? { ...d, status: "提出済", rejectReason: null } : d)));
    });
    // Reset input so the same file can be re-selected if needed
    if (fileInputs.current[code]) fileInputs.current[code]!.value = "";
  };

  const expDate = new Date(expiresAt);
  const daysLeft = Math.max(0, Math.ceil((expDate.getTime() - Date.now()) / 86400000));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="bg-white rounded-2xl shadow-card p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto mb-3">
            <GraduationCap size={22} />
          </div>
          <h1 className="text-xl font-bold">入社書類アップロード</h1>
          <p className="text-sm text-slate-500 mt-1">ようこそ、{caseData.flag} {caseData.candidateName} 様</p>
          <p className="text-xs text-slate-500 mt-1">
            {caseData.schoolName} / {caseData.position} ／ 入社予定日 {caseData.expectedJoinDate}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-[10px] text-slate-400">
            <span>このリンクの有効期限：あと {daysLeft} 日</span>
            <span className="text-slate-300">·</span>
            <span className="font-mono">jti: {jti.slice(0, 8)}…</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold">提出進捗</div>
            <div className="text-2xl font-bold text-brand-600">{progress}%</div>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-500 to-pink-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-slate-500 mt-2">{done} / {docs.length} 項目完了</div>
        </div>

        {err && (
          <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-lg border border-rose-200">
            <AlertCircle size={14} className="inline mr-1" />{err}
          </div>
        )}

        <div className="space-y-3">
          {docs.map((d, i) => {
            const status = d.status;
            const isDone = status === "完了";
            const isReject = status === "差戻し";
            const isPendingReview = status === "確認中" || status === "提出済";
            const isUploading = pendingDoc === d.code && pending;
            return (
              <div
                key={d.code}
                className={clsx(
                  "bg-white rounded-2xl shadow-card p-4 border-l-4",
                  isDone ? "border-emerald-500" : isReject ? "border-rose-500" : isPendingReview ? "border-amber-500" : "border-slate-200"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{d.name}</div>
                    {helpFor[d.code] && <div className="text-xs text-slate-500 mt-0.5">{helpFor[d.code]}</div>}

                    {isReject && d.rejectReason && (
                      <div className="mt-2 text-xs bg-rose-50 text-rose-700 p-2 rounded-lg flex items-start gap-1.5">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />差戻し理由：{d.rejectReason}
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium",
                          isDone && "bg-emerald-100 text-emerald-700",
                          isReject && "bg-rose-100 text-rose-700",
                          isPendingReview && "bg-amber-100 text-amber-700",
                          !isDone && !isReject && !isPendingReview && "bg-slate-100 text-slate-600"
                        )}
                      >
                        {isDone && <Check size={11} />}
                        {status}
                      </span>

                      {(status === "未提出" || status === "差戻し" || status === "提出済") && !isDone && (
                        <>
                          <input
                            ref={(el) => { fileInputs.current[d.code] = el; }}
                            type="file"
                            accept="image/*,application/pdf"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => onSelect(d.code, e.target.files?.[0] ?? null)}
                          />
                          <button
                            onClick={() => fileInputs.current[d.code]?.click()}
                            disabled={isUploading}
                            className="ml-auto inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60"
                          >
                            <Upload size={12} />
                            {isUploading
                              ? "アップロード中..."
                              : isReject
                              ? "再アップロード"
                              : status === "提出済"
                              ? "差し替え"
                              : "ファイルを選択"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4 text-center text-xs text-slate-500">
          ご不明点は人事部（hr@sakura.jp）までお問い合わせください
        </div>
      </div>
    </div>
  );
}
