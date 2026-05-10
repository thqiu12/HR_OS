/**
 * Performance review state machine.
 *
 * 8段階フロー: draft → goal_setting → mid_review → self_eval → first_eval
 *           → second_eval → calibration → feedback → finalized
 * 任意の状態から → cancelled (中止理由必須)
 *
 * 詳細: docs/PERFORMANCE.md
 */

import type { Session } from "next-auth";

export type ReviewStatus =
  | "draft"
  | "goal_setting"
  | "mid_review"
  | "self_eval"
  | "first_eval"
  | "second_eval"
  | "calibration"
  | "feedback"
  | "finalized"
  | "cancelled";

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "下書き",
  goal_setting: "目標設定中",
  mid_review: "中間面談中",
  self_eval: "自己評価中",
  first_eval: "一次評価中",
  second_eval: "二次評価中",
  calibration: "評価会議中",
  feedback: "フィードバック面談中",
  finalized: "確定",
  cancelled: "中止",
};

export const STATUS_ORDER: ReviewStatus[] = [
  "draft",
  "goal_setting",
  "mid_review",
  "self_eval",
  "first_eval",
  "second_eval",
  "calibration",
  "feedback",
  "finalized",
];

/** Linear forward transitions. cancelled is reachable from any non-terminal state. */
const TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  draft: ["goal_setting", "cancelled"],
  goal_setting: ["mid_review", "cancelled"],
  mid_review: ["self_eval", "cancelled"],
  self_eval: ["first_eval", "cancelled"],
  first_eval: ["second_eval", "cancelled"],
  second_eval: ["calibration", "cancelled"],
  calibration: ["feedback", "cancelled"],
  feedback: ["finalized", "cancelled"],
  finalized: [],
  cancelled: [],
};

export function nextStates(s: ReviewStatus): ReviewStatus[] {
  return TRANSITIONS[s] || [];
}

/**
 * Role guard for transitions. Returns null when allowed, or a string message
 * explaining why the actor cannot make this transition.
 *
 * Notes:
 *  - "本人 (subject)": session.user.employeeId === review.employeeId
 *  - "上司 (mgr)": session.user.employeeId === employee.managerId
 *  - "二次評価者 (second)": session.user.employeeId === employee.evaluatorId
 *  - HR roles: group_admin, entity_hr, school_hr
 *  - principal can substitute for second-line review
 */
export function checkTransitionPermission(
  from: ReviewStatus,
  to: ReviewStatus,
  ctx: {
    session: Session;
    isSubject: boolean;
    isManager: boolean;
    isSecondEvaluator: boolean;
  }
): string | null {
  const { session, isSubject, isManager, isSecondEvaluator } = ctx;
  // Inline role check to keep this module client-safe (no DB import)
  const has = (r: string) => session?.roles?.some((x: any) => x.role === r) ?? false;
  const isHR = has("group_admin") || has("entity_hr") || has("school_hr");
  const isPrincipal = has("principal");

  if (to === "cancelled") {
    if (!isHR) return "中止できるのは HR のみです";
    return null;
  }

  // HR can override any forward transition (代理操作)
  if (isHR) return null;

  // Forward transitions (non-HR)
  switch (from + "->" + to) {
    case "draft->goal_setting":
      if (!isHR && !isManager) return "目標設定の開始は HR または上司のみです";
      return null;
    case "goal_setting->mid_review":
      if (!isManager && !isHR) return "中間面談への進行は上司のみです";
      return null;
    case "mid_review->self_eval":
      if (!isManager && !isHR) return "自己評価への移行は上司のみです";
      return null;
    case "self_eval->first_eval":
      if (!isSubject) return "自己評価提出は本人のみです";
      return null;
    case "first_eval->second_eval":
      if (!isManager && !isHR) return "一次評価の完了は上司のみです";
      return null;
    case "second_eval->calibration":
      if (!isSecondEvaluator && !isPrincipal && !isHR) return "二次評価の完了は二次評価者のみです";
      return null;
    case "calibration->feedback":
      if (!isHR) return "評価会議の完了は HR のみです";
      return null;
    case "feedback->finalized":
      if (!isManager && !isHR) return "フィードバック完了は上司または HR のみです";
      return null;
    default:
      return `${from} から ${to} へは遷移できません`;
  }
}

// ===== Scoring =====

export type CategoryWeights = { performance: number; competency: number; behavior: number };
export const DEFAULT_WEIGHTS: CategoryWeights = { performance: 60, competency: 30, behavior: 10 };

export type ReviewItem = {
  category: "performance" | "competency" | "behavior";
  // Both snake_case and camelCase accepted (DB rows arrive as camelCase via rowToCamel,
  // but tests / external callers may use snake_case for clarity matching the SQL schema).
  weight_pct?: number | null;
  weightPct?: number | null;
  final_score?: number | null;
  finalScore?: number | null;
  mgr_score?: number | null;
  mgrScore?: number | null;
};

/**
 * Compute weighted final score across all items.
 * Returns null when not enough data to score.
 */
export function computeReviewScore(items: ReviewItem[], weights: CategoryWeights = DEFAULT_WEIGHTS): number | null {
  const cats = ["performance", "competency", "behavior"] as const;
  const sums: Record<string, { totalScore: number; totalWeight: number }> = {};

  for (const c of cats) {
    sums[c] = { totalScore: 0, totalWeight: 0 };
  }

  for (const it of items) {
    const finalS = it.final_score ?? it.finalScore;
    const mgrS = it.mgr_score ?? it.mgrScore;
    const score = finalS ?? mgrS;
    if (score == null) continue;
    const wp = it.weight_pct ?? it.weightPct;
    if (it.category === "performance") {
      const w = wp ?? 0;
      if (w <= 0) continue;
      sums.performance.totalScore += score * w;
      sums.performance.totalWeight += w;
    } else {
      // Competency / behavior items have equal weight within the category
      sums[it.category].totalScore += score;
      sums[it.category].totalWeight += 1;
    }
  }

  let weighted = 0;
  let weightUsed = 0;
  for (const c of cats) {
    if (sums[c].totalWeight === 0) continue;
    const avg = sums[c].totalScore / sums[c].totalWeight;
    weighted += avg * weights[c];
    weightUsed += weights[c];
  }
  if (weightUsed === 0) return null;
  return weighted / weightUsed;
}

export function scoreToRank(score: number | null): string | null {
  if (score == null) return null;
  if (score >= 4.5) return "S";
  if (score >= 4.0) return "A+";
  if (score >= 3.5) return "A";
  if (score >= 2.5) return "B";
  if (score >= 1.5) return "C";
  return "D";
}

export const RANK_RAISE_PCT: Record<string, number> = {
  S: 10, "A+": 7, A: 5, B: 3, C: 0, D: -2,
};

export const RANK_BONUS_MULTIPLIER: Record<string, number> = {
  S: 2.0, "A+": 1.5, A: 1.2, B: 1.0, C: 0.7, D: 0.0,
};
