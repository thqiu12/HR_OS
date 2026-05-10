"use client";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Plus, FileText, X, Upload, Download, ChevronRight } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createReviewAction, uploadReviewFileAction } from "./actions";
import { startStructuredReviewAction } from "@/lib/review-workflow-actions";

const TYPES = ["試用期間評価", "年度評価", "昇格評価", "給与改定"] as const;
const RATINGS = ["S", "A+", "A", "B", "C", "D"] as const;

export default function ProfileTimeline({
  employee, reviews, reviewFiles = {}, canCreate, defaultEvaluator, autoOpen, suggestType, fromReminderId,
}: {
  employee: { id: string; name: string; probationEnd: string; hireDate: string };
  reviews: any[];
  reviewFiles?: Record<string, any[]>;
  canCreate: boolean;
  defaultEvaluator: string;
  autoOpen?: boolean;
  suggestType?: string;
  fromReminderId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(!!autoOpen);
  const [err, setErr] = useState<string | null>(null);

  const initialType = (TYPES as readonly string[]).includes(suggestType || "") ? suggestType! : "試用期間評価";
  const todayPlus30 = new Date(); todayPlus30.setDate(todayPlus30.getDate() + 30);
  const defaultDue = (suggestType === "試用期間評価" && employee.probationEnd) ? employee.probationEnd : todayPlus30.toISOString().slice(0, 10);
  const defaultPeriod = `${employee.hireDate} 〜 ${defaultDue}`;

  return (
    <Card>
      <CardHeader
        title="📈 評価履歴"
        subtitle="試用期間評価・年度評価・昇格評価・給与改定"
        right={canCreate ? (
          <div className="flex items-center gap-2">
            <StartStructuredReviewButton employee={employee} defaultEvaluator={defaultEvaluator} />
            <Button size="sm" onClick={() => { setOpen(true); setErr(null); }}>
              <Plus size={14} />簡易作成
            </Button>
          </div>
        ) : undefined}
      />
      <div className="p-6">
        {reviews.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8">
            評価履歴はまだありません。{canCreate && "「新規評価作成」から登録してください。"}
          </div>
        ) : (
          <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {reviews.map((r) => {
              const isFuture = r.status === "予定";
              return (
                <div key={r.id} className="relative">
                  <div className={`absolute -left-[26px] top-1 w-5 h-5 rounded-full border-4 ${
                    isFuture ? "bg-white border-slate-300"
                      : r.rating === "S" || r.rating === "A+" ? "bg-emerald-500 border-emerald-200"
                      : r.rating === "A" ? "bg-blue-500 border-blue-200"
                      : "bg-slate-400 border-slate-200"
                  }`} />
                  <div className={`p-4 rounded-xl ${isFuture ? "border border-dashed border-slate-200" : "bg-slate-50"}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={r.type === "昇格評価" ? "emerald" : r.type === "試用期間評価" ? "amber" : "indigo"}>{r.type}</Badge>
                      {r.rating && <Badge tone="violet">評価 {r.rating}</Badge>}
                      <Badge tone={r.status === "完了" ? "emerald" : isFuture ? "slate" : "amber"}>{r.status}</Badge>
                      <span className="ml-auto text-xs text-slate-500">期日：{r.dueDate}</span>
                    </div>
                    <div className="mt-2 text-sm"><span className="text-slate-500">対象期間：</span>{r.periodLabel}</div>
                    <div className="mt-1 text-sm font-medium text-slate-800">{r.result}</div>
                    <div className="mt-2 text-xs text-slate-500">評価者：{r.evaluator}</div>
                    <ReviewFiles reviewId={r.id} files={reviewFiles[r.id] || []} canUpload={canCreate} />
                    <div className="mt-2">
                      <Link href={`/performance/profiles/${employee.id}/review/${r.id}`} className="text-xs text-brand-600 hover:underline inline-flex items-center gap-0.5">
                        詳細 / ワークフローを開く<ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold">📈 新規評価を作成</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <form
              className="p-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setErr(null);
                const fd = new FormData(e.currentTarget as HTMLFormElement);
                start(async () => {
                  try {
                    const ratingRaw = String(fd.get("rating") || "");
                    await createReviewAction({
                      employeeId: employee.id,
                      type: String(fd.get("type")),
                      periodLabel: String(fd.get("periodLabel")),
                      dueDate: String(fd.get("dueDate")),
                      evaluator: String(fd.get("evaluator")),
                      rating: ratingRaw || null,
                      result: String(fd.get("result") || ""),
                      fromReminderId,
                    });
                    setOpen(false);
                    router.refresh();
                  } catch (e: any) {
                    setErr(e?.message || "作成に失敗しました");
                  }
                });
              }}
            >
              {fromReminderId && (
                <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg">
                  📌 リマインダー（{fromReminderId}）から起票中。作成後、当該リマインダーを「対応済み」にマークします。
                </div>
              )}
              <Field label="評価種別">
                <select name="type" defaultValue={initialType} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="対象期間">
                <input name="periodLabel" defaultValue={defaultPeriod} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </Field>
              <Field label="期日">
                <input name="dueDate" type="date" defaultValue={defaultDue} required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </Field>
              <Field label="評価者">
                <input name="evaluator" defaultValue={defaultEvaluator} required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </Field>
              <Field label="評価ランク（任意）">
                <select name="rating" defaultValue="" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">未評価（後で確定）</option>
                  {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="所見・メモ">
                <textarea name="result" rows={3} placeholder="本採用 / 昇給5% / 主任昇格 など" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </Field>
              {err && <div className="text-xs bg-rose-50 text-rose-700 p-2 rounded-lg">{err}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
                <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                  {pending ? "作成中..." : "作成"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}

function StartStructuredReviewButton({ employee, defaultEvaluator }: { employee: any; defaultEvaluator: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const todayPlus30 = new Date(); todayPlus30.setDate(todayPlus30.getDate() + 30);
  const defaultDue = todayPlus30.toISOString().slice(0, 10);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md inline-flex items-center gap-1">
        <Plus size={12} />構造化評価を開始
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold">📋 構造化評価を開始</h3>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setErr(null);
            start(async () => {
              try {
                const r = await startStructuredReviewAction({
                  employeeId: employee.id,
                  type: String(fd.get("type")) as any,
                  periodLabel: String(fd.get("periodLabel")),
                  dueDate: String(fd.get("dueDate")),
                  evaluator: String(fd.get("evaluator")),
                  secondEvaluator: String(fd.get("secondEvaluator") || ""),
                });
                setOpen(false);
                router.push(`/performance/profiles/${employee.id}/review/${r.id}`);
              } catch (e: any) { setErr(e?.message || "作成失敗"); }
            });
          }}
          className="p-5 space-y-3"
        >
          <div className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-lg">
            標準テンプレート (能力4項目+行動3項目) が自動投入されます。業績目標 (MBO) は次の「目標設定」段階で個別追加。
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">評価種別</label>
            <select name="type" defaultValue="annual" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="probation">試用期間評価</option>
              <option value="mid_year">半期評価</option>
              <option value="annual">年度評価</option>
              <option value="promotion">昇格評価</option>
              <option value="special">特別評価</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">対象期間</label>
            <input name="periodLabel" defaultValue="2026年度 通年" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">期日</label>
            <input name="dueDate" type="date" defaultValue={defaultDue} required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">一次評価者</label>
            <input name="evaluator" defaultValue={defaultEvaluator} required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">二次評価者 (任意)</label>
            <input name="secondEvaluator" placeholder="部門長 / 校長など" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          {err && <div className="text-xs bg-rose-50 text-rose-700 p-2 rounded">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
            <button type="submit" disabled={pending} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm disabled:opacity-60">
              {pending ? "作成中..." : "作成して開く"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReviewFiles({ reviewId, files, canUpload }: { reviewId: string; files: any[]; canUpload: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const selfInput = useRef<HTMLInputElement>(null);
  const mgrInput = useRef<HTMLInputElement>(null);

  const upload = (kind: "self" | "manager", file: File | null) => {
    if (!file) return;
    setErr(null);
    const fd = new FormData();
    fd.set("reviewId", reviewId);
    fd.set("fileKind", kind);
    fd.set("file", file);
    start(async () => {
      const r = await uploadReviewFileAction(fd);
      if (!r.ok) setErr(r.error);
      else router.refresh();
    });
    if (selfInput.current) selfInput.current.value = "";
    if (mgrInput.current) mgrInput.current.value = "";
  };

  const selfFiles = files.filter((f) => f.fileKind === "self");
  const mgrFiles = files.filter((f) => f.fileKind === "manager");

  return (
    <div className="mt-3 space-y-2">
      {err && <div className="text-[11px] bg-rose-50 text-rose-700 p-1.5 rounded">{err}</div>}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <FileText size={12} className="text-slate-500" />
          <span className="text-slate-600">述職書：</span>
          {selfFiles.length === 0 && <span className="text-slate-400">未提出</span>}
          {selfFiles.map((f) => (
            <a key={f.id} href={`/api/review/file/${f.id}`} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[11px]">
              <Download size={10} />{f.originalName}
            </a>
          ))}
          {canUpload && (
            <>
              <input ref={selfInput} type="file" accept="application/pdf,image/*" hidden
                     onChange={(e) => upload("self", e.target.files?.[0] ?? null)} />
              <button onClick={() => selfInput.current?.click()} disabled={pending}
                      className="text-brand-600 hover:underline inline-flex items-center gap-0.5 text-[11px] disabled:opacity-50">
                <Upload size={10} />{selfFiles.length === 0 ? "アップロード" : "差し替え"}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <FileText size={12} className="text-slate-500" />
          <span className="text-slate-600">上司評価書：</span>
          {mgrFiles.length === 0 && <span className="text-slate-400">未提出</span>}
          {mgrFiles.map((f) => (
            <a key={f.id} href={`/api/review/file/${f.id}`} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[11px]">
              <Download size={10} />{f.originalName}
            </a>
          ))}
          {canUpload && (
            <>
              <input ref={mgrInput} type="file" accept="application/pdf,image/*" hidden
                     onChange={(e) => upload("manager", e.target.files?.[0] ?? null)} />
              <button onClick={() => mgrInput.current?.click()} disabled={pending}
                      className="text-brand-600 hover:underline inline-flex items-center gap-0.5 text-[11px] disabled:opacity-50">
                <Upload size={10} />{mgrFiles.length === 0 ? "アップロード" : "差し替え"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
