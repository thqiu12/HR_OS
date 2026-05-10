"use client";
import { Card, CardHeader, Badge, Progress, Button, StatusChip } from "@/components/ui";
import { Upload, Check, X, AlertCircle, ExternalLink, Copy } from "lucide-react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { setDocStatus } from "@/lib/actions";
import { useRouter } from "next/navigation";

export default function OnboardingDetailClient({ c, schoolName, canApprove, inviteToken, files }: { c: any; schoolName: string; canApprove: boolean; inviteToken: string | null; files: any[] }) {
  const filesByDoc = (files || []).reduce<Record<string, any[]>>((acc, f) => {
    (acc[f.docCode] ||= []).push(f);
    return acc;
  }, {});
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [docs, setDocs] = useState<any[]>(c.docs);

  const update = (i: number, status: string, rejectReason?: string) => {
    const docCode = docs[i].code;
    setDocs((prev) => prev.map((d, idx) => (idx === i ? { ...d, status, rejectReason: rejectReason ?? d.rejectReason } : d)));
    startTransition(async () => {
      await setDocStatus(c.id, docCode, status, rejectReason);
      router.refresh();
    });
  };

  const completed = docs.filter((d) => d.status === "完了").length;
  const progress = Math.round((completed / docs.length) * 100);
  const inviteUrl = inviteToken && typeof window !== "undefined" ? `${window.location.origin}/onboarding/invite/${inviteToken}` : "";

  return (
    <div className="space-y-6 max-w-5xl">
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{c.flag} {c.candidateName}</h2>
              <Badge tone={c.route === "新卒" ? "blue" : "violet"}>{c.route}</Badge>
              <Badge tone={c.status === "完了" ? "emerald" : c.status === "HR確認中" ? "amber" : "slate"}>{c.status}</Badge>
              {pending && <span className="text-xs text-brand-600">保存中...</span>}
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {schoolName} ／ {c.position} ／ 入社予定日 {c.expectedJoinDate}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-brand-600">{progress}%</div>
            <div className="text-xs text-slate-500">{completed} / {docs.length} 項目完了</div>
          </div>
        </div>
        <div className="mt-4"><Progress value={progress} /></div>
      </Card>

      {inviteToken && (
        <Card>
          <CardHeader title="🔗 内定者ポータル" subtitle="JWT署名付き・30日有効・本人がスマホで個人情報入力・書類アップロード可能" />
          <div className="p-5 flex items-center gap-3 flex-wrap">
            <code className="bg-slate-100 px-3 py-2 rounded-lg text-xs font-mono break-all flex-1 min-w-[300px]">{inviteUrl}</code>
            <Button variant="secondary" size="sm" onClick={() => navigator.clipboard?.writeText(inviteUrl)}><Copy size={14} />コピー</Button>
            <Link href={`/onboarding/invite/${inviteToken}`} target="_blank">
              <Button size="sm"><ExternalLink size={14} />ポータルを開く</Button>
            </Link>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title={`📄 提出書類チェックリスト（${c.route}）`} />
        <div className="divide-y divide-slate-100">
          {docs.map((d, i) => (
            <div key={d.code} className="p-5 flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{d.name}</span>
                  {d.required && <Badge tone="rose" size="xs">必須</Badge>}
                  <StatusChip status={d.status} />
                </div>
                {d.code === "mynumber_card" && (
                  <div className="text-xs text-slate-500 mt-1">💡 マイナンバーカードをお持ちでない方は「マイナンバー記載の住民票」をご提出ください</div>
                )}
                {d.status === "差戻し" && d.rejectReason && (
                  <div className="mt-2 text-xs bg-rose-50 text-rose-700 p-2 rounded-lg flex items-start gap-1.5">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    差戻し理由：{d.rejectReason}
                  </div>
                )}
                {filesByDoc[d.code]?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {filesByDoc[d.code].map((f) => (
                      <a
                        key={f.id}
                        href={`/api/onboarding/file/${f.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded border border-slate-200 mr-1.5"
                      >
                        📎 <span className="font-medium">{f.originalName}</span>
                        <span className="text-slate-400">{Math.round(f.sizeBytes / 1024)}KB</span>
                        <span className="text-slate-400 font-mono text-[10px]">sha:{f.sha256.slice(0, 6)}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {!canApprove ? (
                  <Badge tone="slate" size="xs">閲覧のみ</Badge>
                ) : (
                  <>
                    {d.status === "確認中" && (
                      <>
                        <Button size="sm" onClick={() => update(i, "完了")}><Check size={14} />承認</Button>
                        <Button variant="danger" size="sm" onClick={() => update(i, "差戻し", "再提出をお願いします")}><X size={14} />差戻し</Button>
                      </>
                    )}
                    {d.status === "差戻し" && (
                      <Button variant="secondary" size="sm" onClick={() => update(i, "確認中")}>再確認へ</Button>
                    )}
                    {d.status === "未提出" && (
                      <Button variant="ghost" size="sm" onClick={() => update(i, "提出済")}><Upload size={14} />提出済にする</Button>
                    )}
                    {d.status === "提出済" && (
                      <Button size="sm" onClick={() => update(i, "確認中")}>HR確認開始</Button>
                    )}
                    {d.status === "完了" && (
                      <Badge tone="emerald"><Check size={12} className="inline mr-1" />承認済</Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
