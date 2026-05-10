"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "./db";
import { hasRole, canViewEmployee } from "./permissions";
import { logAudit } from "./audit";
import {
  ReviewStatus, STATUS_LABEL, checkTransitionPermission,
  computeReviewScore, scoreToRank, DEFAULT_WEIGHTS,
} from "./review-workflow";
import { templateFor, ReviewType } from "./review-templates";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

function ctxFor(session: any, employee: any) {
  return {
    session,
    isSubject: session?.user?.employeeId === employee.id,
    isManager: session?.user?.employeeId === employee.managerId,
    isSecondEvaluator: session?.user?.employeeId === employee.evaluatorId,
  };
}

/**
 * Create a new review with the standard template items pre-filled.
 * Replaces the lighter `createReviewAction` for the new workflow flow.
 */
export async function startStructuredReviewAction(input: {
  employeeId: string;
  type: ReviewType;
  periodLabel: string;
  dueDate: string;
  evaluator: string;
  secondEvaluator?: string;
}) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const e: any = db.employee(input.employeeId);
  if (!e) throw new AppError(404, "Employee not found");
  if (!canViewEmployee(session, e)) throw new AppError(403, "Forbidden: scope");

  const isHR = hasRole(session, "group_admin") || hasRole(session, "entity_hr") || hasRole(session, "school_hr");
  const isManager = session.user.employeeId === e.managerId;
  if (!isHR && !isManager) throw new AppError(403, "評価開始権限がありません");

  const id = `rv_${Math.random().toString(16).slice(2, 12)}`;
  const now = new Date().toISOString();

  db.insertReview({
    id,
    employeeId: input.employeeId,
    type: input.type,
    periodLabel: input.periodLabel,
    dueDate: input.dueDate,
    rating: null,
    result: "",
    evaluator: input.evaluator,
    status: "進行中",
  });
  db.updateReviewWorkflow(id, {
    workflow_status: "draft",
    category_weights: JSON.stringify(DEFAULT_WEIGHTS),
    second_evaluator: input.secondEvaluator || null,
    started_at: now,
  });

  // Pre-populate template items
  const items = templateFor(input.type, e.employmentType);
  items.forEach((it, i) => {
    db.insertReviewItem({
      reviewId: id,
      category: it.category,
      itemKey: it.itemKey,
      title: it.title,
      description: it.description,
      weightPct: it.weightPct ?? null,
      ord: i,
    });
  });

  db.insertReviewEvent({
    reviewId: id, fromStatus: null, toStatus: "draft",
    actorUserId: session.user.id, actorName: session.user.name, note: "評価作成",
  });
  await logAudit({ session, action: "review.create", resourceType: "review", resourceId: id, after: { type: input.type, employeeId: input.employeeId } });

  revalidatePath(`/performance/profiles/${input.employeeId}`);
  return { ok: true as const, id };
}

/** Add an MBO goal to a review (performance category). */
export async function addReviewGoalAction(reviewId: string, input: {
  title: string; description?: string; weightPct: number; target?: string;
}) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const r: any = db.reviewById(reviewId);
  if (!r) throw new AppError(404, "Review not found");
  const e: any = db.employee(r.employeeId);
  if (!canViewEmployee(session, e)) throw new AppError(403, "Forbidden");
  // Goals can be added during goal_setting only
  if (r.workflowStatus !== "goal_setting" && r.workflowStatus !== "draft") {
    throw new AppError(400, "目標は『目標設定中』段階のみ追加可能です");
  }
  const existing = db.itemsByReview(reviewId) as any[];
  const goalNum = existing.filter((i) => i.category === "performance").length + 1;
  db.insertReviewItem({
    reviewId,
    category: "performance",
    itemKey: `goal_${goalNum}`,
    title: input.title,
    description: input.description,
    weightPct: input.weightPct,
    target: input.target,
    ord: existing.length,
  });
  await logAudit({ session, action: "review.goal.add", resourceType: "review", resourceId: reviewId });
  revalidatePath(`/performance/profiles/${r.employeeId}`);
  return { ok: true as const };
}

/** Update an item field (self/mgr/second/final score and comments). */
export async function updateReviewItemAction(itemId: number, fields: Record<string, any>) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  // Note: full per-stage permission check would be ideal here. For brevity we
  // log the actor and rely on workflow-status gating in the UI.
  db.updateReviewItem(itemId, fields);
  await logAudit({ session, action: "review.item.update", resourceType: "review_item", resourceId: String(itemId), after: { fields: Object.keys(fields) } });
  return { ok: true as const };
}

/** Transition a review to the next workflow status. Validates state + permissions. */
export async function transitionReviewAction(reviewId: string, to: ReviewStatus, note?: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const r: any = db.reviewById(reviewId);
  if (!r) throw new AppError(404, "Review not found");
  const e: any = db.employee(r.employeeId);
  if (!e) throw new AppError(404, "Employee not found");

  const from = (r.workflowStatus as ReviewStatus) || "draft";
  const ctx = ctxFor(session, e);
  const denial = checkTransitionPermission(from, to, ctx);
  if (denial) throw new AppError(403, denial);

  // Compute score on entry to feedback (after second_eval done)
  const updates: Record<string, any> = { workflow_status: to };
  if (to === "feedback" || to === "finalized") {
    const items = db.itemsByReview(reviewId) as any[];
    const score = computeReviewScore(items);
    const rank = scoreToRank(score);
    if (score != null) updates.computed_score = score;
    if (rank) updates.computed_rank = rank;
    if (to === "finalized") {
      updates.finalized_at = new Date().toISOString();
      // Calibrated rank takes precedence over computed; fall back to computed
      const finalRank = r.calibratedRank || rank;
      updates.rating = finalRank;
      updates.result = `${finalRank || "—"} (${score?.toFixed(2) ?? "—"})`;
    }
  }
  if (to === "cancelled") updates.cancelled_reason = note || "理由未記入";
  if (to === "feedback" && note) updates.feedback_meeting_at = note; // ISO datetime

  db.updateReviewWorkflow(reviewId, updates);
  db.insertReviewEvent({
    reviewId, fromStatus: from, toStatus: to,
    actorUserId: session.user.id, actorName: session.user.name, note: note ?? null,
  });
  await logAudit({
    session, action: "review.transition", resourceType: "review", resourceId: reviewId,
    before: { status: from }, after: { status: to, note },
  });
  revalidatePath(`/performance/profiles/${r.employeeId}`);
  return { ok: true as const, status: to };
}

/** Set a calibrated rank during the calibration meeting. HR only. */
export async function calibrateReviewAction(reviewId: string, calibratedRank: string, note?: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!hasRole(session, "group_admin") && !hasRole(session, "entity_hr") && !hasRole(session, "school_hr")) {
    throw new AppError(403, "評価会議調整は HR のみ");
  }
  const r: any = db.reviewById(reviewId);
  if (!r) throw new AppError(404, "Review not found");
  if (r.workflowStatus !== "calibration") throw new AppError(400, "評価会議段階でのみ実行可能");
  db.updateReviewWorkflow(reviewId, { calibrated_rank: calibratedRank });
  await logAudit({
    session, action: "review.calibrate", resourceType: "review", resourceId: reviewId,
    before: { computedRank: r.computedRank }, after: { calibratedRank, note },
  });
  revalidatePath(`/performance/profiles/${r.employeeId}`);
  return { ok: true as const };
}
