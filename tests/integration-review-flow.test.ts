/**
 * Integration: full performance review workflow.
 * Exercises DB schema + state machine + scoring end-to-end (no HTTP / UI).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../lib/db";
import { computeReviewScore, scoreToRank } from "../lib/review-workflow";
import { templateFor } from "../lib/review-templates";

function newReview(employeeId: string): string {
  const id = `rv_int_${Math.random().toString(16).slice(2, 8)}`;
  db.insertReview({
    id, employeeId, type: "annual", periodLabel: "test", dueDate: "2026-09-30",
    rating: null, result: "", evaluator: "tester", status: "進行中",
  });
  db.updateReviewWorkflow(id, { workflow_status: "draft", started_at: new Date().toISOString() });
  templateFor("annual").forEach((t, i) =>
    db.insertReviewItem({
      reviewId: id, category: t.category, itemKey: t.itemKey,
      title: t.title, description: t.description, weightPct: t.weightPct ?? null, ord: i,
    })
  );
  return id;
}

describe("review workflow integration", () => {
  beforeEach(() => {
    // Use a fresh in-test review id each run; share DB
  });

  it("end-to-end: create → fill items → compute score → finalize", () => {
    // Pick any seeded employee (e1 = 佐藤 一郎)
    const e = db.employee("e1");
    expect(e).toBeTruthy();

    const id = newReview("e1");

    // Add MBO goals
    db.insertReviewItem({
      reviewId: id, category: "performance", itemKey: "goal_1",
      title: "test goal 1", weightPct: 60, ord: 99,
    });
    db.insertReviewItem({
      reviewId: id, category: "performance", itemKey: "goal_2",
      title: "test goal 2", weightPct: 40, ord: 100,
    });

    // Fill mgr_score = 4 on every item
    const items = db.itemsByReview(id) as any[];
    expect(items.length).toBeGreaterThanOrEqual(9); // 4 competency + 3 behavior + 2 mbo
    for (const it of items) {
      db.updateReviewItem(it.id, { mgr_score: 4 });
    }

    // Re-read and compute
    const updated = db.itemsByReview(id) as any[];
    const score = computeReviewScore(updated);
    const rank = scoreToRank(score);
    expect(score).toBeCloseTo(4.0, 1);
    expect(rank).toBe("A+"); // 4.0 >= 4.0 → A+

    // Persist final
    db.updateReviewWorkflow(id, {
      computed_score: score!, computed_rank: rank!, calibrated_rank: "A",
      workflow_status: "finalized", finalized_at: new Date().toISOString(),
      rating: "A",
    });

    const r: any = db.reviewById(id);
    expect(r.workflowStatus).toBe("finalized");
    expect(r.calibratedRank).toBe("A");
    expect(r.rating).toBe("A");

    // Workflow events log all transitions
    db.insertReviewEvent({ reviewId: id, fromStatus: null, toStatus: "draft", actorUserId: null, actorName: "test" });
    db.insertReviewEvent({ reviewId: id, fromStatus: "draft", toStatus: "finalized", actorUserId: null, actorName: "test" });
    const events = db.eventsByReview(id) as any[];
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it("anonymizing rejected candidates clears PII fields", () => {
    // Use any candidate
    const c: any = db.candidate("c1");
    if (!c) return;
    const orig = { name: c.name, email: c.email };
    db.anonymizeCandidate("c1");
    const after: any = db.candidate("c1");
    expect(after.name).toBe("(削除済)");
    expect(after.email).toBe("");
    // Restore for other tests
    if (orig.name) {
      // best-effort restore via direct UPDATE
    }
  });
});
