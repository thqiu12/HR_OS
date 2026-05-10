"use client";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Save, AlertTriangle, Check } from "lucide-react";
import {
  addReviewGoalAction, updateReviewItemAction, transitionReviewAction, calibrateReviewAction,
} from "@/lib/review-workflow-actions";
import { STATUS_LABEL, nextStates, RANK_RAISE_PCT, RANK_BONUS_MULTIPLIER } from "@/lib/review-workflow";

type Permissions = {
  isHR: boolean; isPrincipal: boolean; isManager: boolean; isSubject: boolean; isSecondEvaluator: boolean;
};

const SCORE_LABELS: Record<number, string> = { 5: "S 期待を大きく超える", 4: "A 期待を上回る", 3: "B 期待通り", 2: "C 期待を下回る", 1: "D 大幅に下回る" };

export default function ReviewDetailClient({
  review, items, events, employee, permissions, liveScore, liveRank,
}: {
  review: any; items: any[]; events: any[]; employee: any;
  permissions: Permissions; liveScore: number | null; liveRank: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const status = review.workflowStatus || "draft";
  const performanceItems = items.filter((i) => i.category === "performance");
  const competencyItems = items.filter((i) => i.category === "competency");
  const behaviorItems = items.filter((i) => i.category === "behavior");

  const can = {
    addGoal: (status === "goal_setting" || status === "draft") && (permissions.isManager || permissions.isHR),
    selfEval: status === "self_eval" && permissions.isSubject,
    mgrEval: status === "first_eval" && (permissions.isManager || permissions.isHR),
    secondEval: status === "second_eval" && (permissions.isSecondEvaluator || permissions.isPrincipal || permissions.isHR),
    calibrate: status === "calibration" && permissions.isHR,
    transition: !["finalized", "cancelled"].includes(status),
  };

  const transitions = nextStates(status as any);

  function doTransition(to: string, note?: string) {
    setErr(null);
    start(async () => {
      try {
        await transitionReviewAction(review.id, to as any, note);
        setInfo(`→ ${STATUS_LABEL[to as keyof typeof STATUS_LABEL]} に移行しました`);
        router.refresh();
      } catch (e: any) {
        setErr(e?.message || "遷移に失敗");
      }
    });
  }

  return (
    <>
      {err && <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-lg flex items-center gap-2"><AlertTriangle size={14} />{err}</div>}
      {info && <div className="bg-emerald-50 text-emerald-700 text-xs p-3 rounded-lg flex items-center gap-2"><Check size={14} />{info}</div>}

      {/* Performance / MBO */}
      <Card>
        <CardHeader
          title="🎯 業績評価 (MBO 60%)"
          subtitle="目標達成度を本人 → 上司の順で評価"
          right={can.addGoal && <AddGoalButton reviewId={review.id} onDone={() => router.refresh()} />}
        />
        <div className="p-5 space-y-3">
          {performanceItems.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">目標が登録されていません。{can.addGoal && "「目標を追加」から登録してください。"}</p>
          ) : (
            performanceItems.map((it) => (
              <ItemRow
                key={it.id} item={it}
                showSelf={can.selfEval}
                showMgr={can.mgrEval}
                showSecond={can.secondEval}
                isPerformance
              />
            ))
          )}
          {performanceItems.length > 0 && (
            <div className="text-xs text-right text-slate-500">
              ウェイト合計: {performanceItems.reduce((s, i) => s + (i.weightPct || 0), 0)}% (合計100%が望ましい)
            </div>
          )}
        </div>
      </Card>

      {/* Competency */}
      <Card>
        <CardHeader title="💎 能力評価 (30%)" subtitle="4 項目固定 / 各 5 段階" />
        <div className="p-5 space-y-3">
          {competencyItems.map((it) => (
            <ItemRow key={it.id} item={it}
              showSelf={can.selfEval} showMgr={can.mgrEval} showSecond={can.secondEval} />
          ))}
        </div>
      </Card>

      {/* Behavior */}
      <Card>
        <CardHeader title="🌱 行動・価値観 (10%)" subtitle="3 項目固定 / 各 5 段階" />
        <div className="p-5 space-y-3">
          {behaviorItems.map((it) => (
            <ItemRow key={it.id} item={it}
              showSelf={can.selfEval} showMgr={can.mgrEval} showSecond={can.secondEval} />
          ))}
        </div>
      </Card>

      {/* Calibration */}
      {(status === "calibration" || status === "feedback" || status === "finalized") && (
        <Card>
          <CardHeader title="⚖️ 評価会議 (キャリブレーション)" />
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <Stat label="算定スコア" value={liveScore != null ? liveScore.toFixed(2) : "—"} />
              <Stat label="算定ランク (調整前)" value={liveRank || "—"} />
              <Stat label="確定ランク" value={review.calibratedRank || "—"} />
            </div>
            {can.calibrate && <CalibrateForm reviewId={review.id} suggestedRank={liveRank} onDone={() => router.refresh()} />}
            {review.calibratedRank && (
              <div className="bg-emerald-50 text-emerald-800 text-sm p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <span>給与改定目安:</span>
                  <code className="font-bold">{RANK_RAISE_PCT[review.calibratedRank] >= 0 ? "+" : ""}{RANK_RAISE_PCT[review.calibratedRank]}%</code>
                  <span>賞与係数:</span>
                  <code className="font-bold">{RANK_BONUS_MULTIPLIER[review.calibratedRank]?.toFixed(1)}×</code>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Workflow controls */}
      {can.transition && (
        <Card>
          <CardHeader title="⏩ 次のステップ" />
          <div className="p-5 flex flex-wrap gap-2">
            {transitions.map((t) => {
              const isCancel = t === "cancelled";
              return (
                <button
                  key={t}
                  onClick={() => {
                    if (isCancel) {
                      const reason = prompt("中止理由を入力してください");
                      if (!reason) return;
                      doTransition(t, reason);
                    } else if (t === "feedback") {
                      const at = prompt("フィードバック面談 実施日時 (例: 2026-04-20T14:00)");
                      if (at == null) return;
                      doTransition(t, at || undefined);
                    } else {
                      doTransition(t);
                    }
                  }}
                  disabled={pending}
                  className={`px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1.5 ${
                    isCancel ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-brand-600 text-white hover:bg-brand-700"
                  } disabled:opacity-60`}
                >
                  {STATUS_LABEL[t]}<ChevronRight size={14} />
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader title="📜 ワークフロー履歴" />
        <div className="p-5 space-y-2 text-xs">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-3 border-b border-slate-50 pb-2 last:border-0">
              <code className="text-slate-400">{new Date(ev.ts).toLocaleString("ja-JP")}</code>
              <span className="text-slate-600">{ev.actorName || "system"}</span>
              <span className="text-slate-400">→</span>
              <Badge tone="indigo" size="xs">{STATUS_LABEL[ev.toStatus as keyof typeof STATUS_LABEL] || ev.toStatus}</Badge>
              {ev.note && <span className="text-slate-500 ml-2">{ev.note}</span>}
            </div>
          ))}
          {events.length === 0 && <p className="text-slate-500 text-center py-2">履歴なし</p>}
        </div>
      </Card>
    </>
  );
}

function ItemRow({ item, showSelf, showMgr, showSecond, isPerformance }: { item: any; showSelf: boolean; showMgr: boolean; showSecond: boolean; isPerformance?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function update(field: string, value: any) {
    start(async () => {
      try {
        await updateReviewItemAction(item.id, { [field]: value });
        router.refresh();
      } catch {}
    });
  }

  const scoreOptions = [
    { v: 5, label: "5 (S)" }, { v: 4, label: "4 (A)" }, { v: 3, label: "3 (B)" }, { v: 2, label: "2 (C)" }, { v: 1, label: "1 (D)" },
  ];

  return (
    <div className="border border-slate-100 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="font-medium text-sm flex items-center gap-2">
            {item.title}
            {isPerformance && item.weightPct && <Badge tone="indigo" size="xs">{item.weightPct}%</Badge>}
          </div>
          {item.description && <p className="text-xs text-slate-500 mt-1">{item.description}</p>}
          {item.target && <p className="text-xs text-slate-600 mt-1">目標: {item.target}</p>}
        </div>
        <div className="text-right text-xs text-slate-500">
          {item.finalScore && <Badge tone="emerald">最終 {item.finalScore}</Badge>}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="font-medium mb-2 text-slate-700">本人</div>
          {showSelf ? (
            <>
              <select defaultValue={item.selfScore || ""} onChange={(e) => update("self_score", e.target.value ? Number(e.target.value) : null)} className="w-full px-2 py-1 border border-slate-200 rounded text-xs mb-1">
                <option value="">— 未評価 —</option>
                {scoreOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              <textarea defaultValue={item.selfComment || ""} onBlur={(e) => update("self_comment", e.target.value)} placeholder="所見" rows={2} className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
            </>
          ) : (
            <>
              <div>{item.selfScore != null ? `${item.selfScore} (${SCORE_LABELS[item.selfScore]?.split(" ")[0]})` : "—"}</div>
              <p className="text-slate-600 mt-1 whitespace-pre-wrap">{item.selfComment || "—"}</p>
            </>
          )}
        </div>

        <div className="bg-slate-50 rounded-lg p-3">
          <div className="font-medium mb-2 text-slate-700">一次評価 (上司)</div>
          {showMgr ? (
            <>
              <select defaultValue={item.mgrScore || ""} onChange={(e) => update("mgr_score", e.target.value ? Number(e.target.value) : null)} className="w-full px-2 py-1 border border-slate-200 rounded text-xs mb-1">
                <option value="">— 未評価 —</option>
                {scoreOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              <textarea defaultValue={item.mgrComment || ""} onBlur={(e) => update("mgr_comment", e.target.value)} placeholder="所見" rows={2} className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
            </>
          ) : (
            <>
              <div>{item.mgrScore != null ? `${item.mgrScore} (${SCORE_LABELS[item.mgrScore]?.split(" ")[0]})` : "—"}</div>
              <p className="text-slate-600 mt-1 whitespace-pre-wrap">{item.mgrComment || "—"}</p>
            </>
          )}
        </div>

        <div className="bg-slate-50 rounded-lg p-3">
          <div className="font-medium mb-2 text-slate-700">二次評価</div>
          {showSecond ? (
            <>
              <select defaultValue={item.secondScore || ""} onChange={(e) => update("second_score", e.target.value ? Number(e.target.value) : null)} className="w-full px-2 py-1 border border-slate-200 rounded text-xs mb-1">
                <option value="">— 同意 (一次に従う) —</option>
                {scoreOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              <textarea defaultValue={item.secondComment || ""} onBlur={(e) => update("second_comment", e.target.value)} placeholder="調整理由" rows={2} className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
            </>
          ) : (
            <>
              <div>{item.secondScore != null ? `${item.secondScore}` : (item.mgrScore != null ? "(一次に同意)" : "—")}</div>
              <p className="text-slate-600 mt-1 whitespace-pre-wrap">{item.secondComment || "—"}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddGoalButton({ reviewId, onDone }: { reviewId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!open) return <Button size="sm" onClick={() => setOpen(true)}><Plus size={14} />目標を追加</Button>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          await addReviewGoalAction(reviewId, {
            title: String(fd.get("title")),
            description: String(fd.get("description") || ""),
            weightPct: Number(fd.get("weightPct")),
            target: String(fd.get("target") || ""),
          });
          setOpen(false); onDone();
        });
      }}
      className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 w-72"
    >
      <input name="title" required placeholder="目標名" className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
      <input name="target" placeholder="目標値 (例: TOEIC 800点)" className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
      <input name="weightPct" type="number" min={1} max={100} required placeholder="ウェイト %" className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
      <textarea name="description" placeholder="達成基準" rows={2} className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500">キャンセル</button>
        <button type="submit" disabled={pending} className="ml-auto px-2 py-1 bg-brand-600 text-white rounded text-xs">追加</button>
      </div>
    </form>
  );
}

function CalibrateForm({ reviewId, suggestedRank, onDone }: { reviewId: string; suggestedRank: string | null; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          await calibrateReviewAction(reviewId, String(fd.get("rank")), String(fd.get("note") || ""));
          onDone();
        });
      }}
      className="flex flex-wrap items-end gap-2 bg-amber-50 p-3 rounded-lg"
    >
      <label className="text-xs text-amber-800">
        確定ランク
        <select name="rank" defaultValue={suggestedRank || "B"} className="ml-2 px-2 py-1 border border-slate-200 rounded text-xs">
          {["S", "A+", "A", "B", "C", "D"].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <input name="note" placeholder="調整理由 (任意)" className="flex-1 min-w-40 px-2 py-1 border border-slate-200 rounded text-xs" />
      <button type="submit" disabled={pending} className="px-3 py-1 bg-amber-600 text-white rounded text-xs"><Save size={12} className="inline mr-1" />確定</button>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-bold text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}
