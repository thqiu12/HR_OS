import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canViewEmployee, hasRole } from "@/lib/permissions";
import { Card, CardHeader, Badge, Forbidden } from "@/components/ui";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ReviewDetailClient from "./client";
import { STATUS_LABEL, STATUS_ORDER, computeReviewScore, scoreToRank } from "@/lib/review-workflow";
import { TYPE_LABEL, ReviewType } from "@/lib/review-templates";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: { params: { id: string; reviewId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  const r: any = db.reviewById(params.reviewId);
  if (!r) return notFound();
  const e: any = db.employee(r.employeeId);
  if (!e) return notFound();
  if (!canViewEmployee(session, e)) return <Forbidden />;
  if (r.employeeId !== params.id) return notFound();

  const items: any[] = db.itemsByReview(params.reviewId) as any[];
  const events: any[] = db.eventsByReview(params.reviewId) as any[];

  const isHR = hasRole(session, "group_admin") || hasRole(session, "entity_hr") || hasRole(session, "school_hr");
  const isPrincipal = hasRole(session, "principal");
  const isManager = session.user.employeeId === e.managerId;
  const isSubject = session.user.employeeId === e.id;
  const isSecondEvaluator = session.user.employeeId === e.evaluatorId;

  const liveScore = computeReviewScore(items);
  const liveRank = scoreToRank(liveScore);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/performance/profiles/${e.id}`} className="text-brand-600 hover:underline">← {e.name} のプロフィールへ戻る</Link>
      </div>

      <Card>
        <CardHeader
          title={`📋 ${TYPE_LABEL[r.type as ReviewType] || r.type}`}
          subtitle={`${e.name} ｜ ${r.periodLabel}`}
          right={
            <div className="flex items-center gap-2">
              <Badge tone="indigo">{STATUS_LABEL[r.workflowStatus as keyof typeof STATUS_LABEL] || r.workflowStatus || r.status}</Badge>
              {r.calibratedRank && <Badge tone="emerald">確定 {r.calibratedRank}</Badge>}
              {!r.calibratedRank && r.computedRank && <Badge tone="violet">仮 {r.computedRank}</Badge>}
            </div>
          }
        />
        <div className="p-5 space-y-3">
          <div className="grid sm:grid-cols-4 gap-3 text-sm">
            <Stat label="期日" value={r.dueDate} />
            <Stat label="一次評価者" value={r.evaluator} />
            <Stat label="二次評価者" value={r.secondEvaluator || "—"} />
            <Stat label="計算スコア" value={liveScore != null ? liveScore.toFixed(2) : "—"} />
          </div>

          {/* Workflow stepper */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 overflow-x-auto">
            {STATUS_ORDER.map((s, i) => {
              const currentIdx = STATUS_ORDER.indexOf(r.workflowStatus as any);
              const isPast = currentIdx > i;
              const isNow = currentIdx === i;
              return (
                <div key={s} className="flex flex-col items-center min-w-fit px-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isPast ? "bg-emerald-500 text-white" :
                    isNow ? "bg-brand-600 text-white" :
                    "bg-slate-200 text-slate-400"
                  }`}>{i + 1}</div>
                  <div className={`text-[10px] mt-1 whitespace-nowrap ${isNow ? "font-bold" : "text-slate-500"}`}>
                    {STATUS_LABEL[s].replace("中", "")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <ReviewDetailClient
        review={r}
        items={items}
        events={events}
        employee={{ id: e.id, name: e.name, managerId: e.managerId, evaluatorId: e.evaluatorId }}
        permissions={{ isHR, isPrincipal, isManager, isSubject, isSecondEvaluator }}
        liveScore={liveScore}
        liveRank={liveRank}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}
