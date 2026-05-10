import { describe, it, expect } from "vitest";
import {
  nextStates, checkTransitionPermission, computeReviewScore,
  scoreToRank, DEFAULT_WEIGHTS,
} from "../lib/review-workflow";

describe("review workflow state machine", () => {
  it("draft transitions to goal_setting and cancelled only", () => {
    expect(nextStates("draft").sort()).toEqual(["cancelled", "goal_setting"].sort());
  });

  it("finalized is terminal (no further transitions)", () => {
    expect(nextStates("finalized")).toEqual([]);
  });

  it("cancelled is terminal", () => {
    expect(nextStates("cancelled")).toEqual([]);
  });

  it("subject can submit self_eval → first_eval", () => {
    const session = { roles: [{ role: "employee" }], user: {} } as any;
    const result = checkTransitionPermission("self_eval", "first_eval", {
      session, isSubject: true, isManager: false, isSecondEvaluator: false,
    });
    expect(result).toBeNull();
  });

  it("non-subject non-HR blocked from self_eval → first_eval", () => {
    const session = { roles: [{ role: "manager" }], user: {} } as any;
    const result = checkTransitionPermission("self_eval", "first_eval", {
      session, isSubject: false, isManager: true, isSecondEvaluator: false,
    });
    expect(result).not.toBeNull();
    expect(result).toContain("本人");
  });

  it("HR can override self_eval → first_eval (代理操作)", () => {
    const session = { roles: [{ role: "school_hr" }], user: {} } as any;
    const result = checkTransitionPermission("self_eval", "first_eval", {
      session, isSubject: false, isManager: false, isSecondEvaluator: false,
    });
    expect(result).toBeNull();
  });

  it("HR can cancel from any forward state", () => {
    const session = { roles: [{ role: "group_admin" }], user: {} } as any;
    for (const s of ["draft", "goal_setting", "first_eval", "calibration"] as const) {
      const r = checkTransitionPermission(s, "cancelled", {
        session, isSubject: false, isManager: false, isSecondEvaluator: false,
      });
      expect(r).toBeNull();
    }
  });

  it("non-HR cannot cancel", () => {
    const session = { roles: [{ role: "manager" }], user: {} } as any;
    const r = checkTransitionPermission("first_eval", "cancelled", {
      session, isSubject: false, isManager: true, isSecondEvaluator: false,
    });
    expect(r).toContain("HR");
  });

  it("HR-only transition: calibration → feedback", () => {
    const sessionMgr = { roles: [{ role: "manager" }], user: {} } as any;
    const sessionHR = { roles: [{ role: "school_hr" }], user: {} } as any;
    expect(checkTransitionPermission("calibration", "feedback", { session: sessionMgr, isSubject: false, isManager: true, isSecondEvaluator: false })).not.toBeNull();
    expect(checkTransitionPermission("calibration", "feedback", { session: sessionHR, isSubject: false, isManager: false, isSecondEvaluator: false })).toBeNull();
  });
});

describe("review scoring", () => {
  it("returns null when no items have scores", () => {
    expect(computeReviewScore([])).toBeNull();
    expect(computeReviewScore([{ category: "competency", final_score: null }])).toBeNull();
  });

  it("uses final_score when set, else mgr_score", () => {
    const items = [
      { category: "competency" as const, final_score: 4 },
      { category: "competency" as const, mgr_score: 3, final_score: null },
      { category: "competency" as const, mgr_score: 5, final_score: null },
      { category: "competency" as const, mgr_score: 4, final_score: null },
    ];
    const score = computeReviewScore(items);
    // competency avg = (4+3+5+4)/4 = 4.0; weights 30 / 30 used
    expect(score).toBeCloseTo(4.0, 2);
  });

  it("weights performance category by item weight_pct", () => {
    const items = [
      { category: "performance" as const, weight_pct: 60, final_score: 5 },
      { category: "performance" as const, weight_pct: 40, final_score: 3 },
    ];
    // weighted = (5*60 + 3*40)/100 = 4.2
    // total = (4.2 * 60) / 60 = 4.2
    const score = computeReviewScore(items);
    expect(score).toBeCloseTo(4.2, 2);
  });

  it("applies category weights when all 3 categories present", () => {
    const items = [
      { category: "performance" as const, weight_pct: 100, final_score: 5 },
      { category: "competency" as const, final_score: 3 },
      { category: "behavior" as const, final_score: 1 },
    ];
    // performance avg = 5, competency avg = 3, behavior avg = 1
    // total = (5*60 + 3*30 + 1*10) / 100 = (300+90+10)/100 = 4.0
    const score = computeReviewScore(items);
    expect(score).toBeCloseTo(4.0, 2);
  });

  it("scoreToRank thresholds", () => {
    expect(scoreToRank(4.7)).toBe("S");
    expect(scoreToRank(4.2)).toBe("A+");
    expect(scoreToRank(3.7)).toBe("A");
    expect(scoreToRank(3.0)).toBe("B");
    expect(scoreToRank(2.0)).toBe("C");
    expect(scoreToRank(1.0)).toBe("D");
    expect(scoreToRank(null)).toBeNull();
  });

  it("default weights sum to 100", () => {
    const sum = DEFAULT_WEIGHTS.performance + DEFAULT_WEIGHTS.competency + DEFAULT_WEIGHTS.behavior;
    expect(sum).toBe(100);
  });

  it("ignores items with missing scores in average", () => {
    const items = [
      { category: "competency" as const, final_score: 4 },
      { category: "competency" as const, final_score: null },
      { category: "competency" as const, mgr_score: null, final_score: null },
    ];
    const score = computeReviewScore(items);
    // only one valid item with score 4 in competency
    expect(score).toBeCloseTo(4.0, 2);
  });
});
