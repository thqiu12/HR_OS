import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

const id = (p: string) => `${p}_${randomBytes(4).toString("hex")}`;

describe("interview DB layer", () => {
  it("inserts and queries by candidate", () => {
    const ivId = id("iv");
    db.insertInterview({
      id: ivId,
      candidateId: "c1",
      round: "一次面接",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      durationMin: 60,
      format: "online",
      location: "https://meet.google.com/abc",
      interviewerNames: "佐藤一郎",
      status: "scheduled",
      createdBy: "u1",
    });
    const list = db.interviewsByCandidate("c1") as any[];
    expect(list.find((x) => x.id === ivId)).toBeTruthy();
  });

  it("upcomingInterviews filters past + non-scheduled", () => {
    const past = id("iv");
    db.insertInterview({
      id: past, candidateId: "c2", round: "一次面接",
      scheduledAt: new Date(Date.now() - 86400000).toISOString(),
      format: "online", status: "scheduled",
    });
    const future = id("iv");
    db.insertInterview({
      id: future, candidateId: "c2", round: "一次面接",
      scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString(),
      format: "online", status: "scheduled",
    });
    const up = db.upcomingInterviews(100) as any[];
    expect(up.find((x) => x.id === future)).toBeTruthy();
    expect(up.find((x) => x.id === past)).toBeUndefined();
  });

  it("updateInterview applies partial fields", () => {
    const ivId = id("iv");
    db.insertInterview({
      id: ivId, candidateId: "c1", round: "二次面接",
      scheduledAt: new Date().toISOString(), format: "offline", status: "scheduled",
    });
    db.updateInterview(ivId, { status: "completed", result: "pass", feedback: "良い候補者" });
    const list = db.interviewsByCandidate("c1") as any[];
    const iv = list.find((x: any) => x.id === ivId);
    expect(iv.status).toBe("completed");
    expect(iv.result).toBe("pass");
    expect(iv.feedback).toBe("良い候補者");
  });
});

describe("employee_assignments DB layer", () => {
  it("backfilled primary assignment for each employee", () => {
    const e1 = db.assignmentsByEmployee("e1") as any[];
    expect(e1.length).toBeGreaterThan(0);
    expect(e1[0].isPrimary).toBe(1);
  });

  it("inserts multi-assignment row", () => {
    const aid = id("asg");
    db.insertAssignment({
      id: aid, employeeId: "e2", schoolId: "s2", departmentId: "d4",
      position: "兼任講師", isPrimary: false, assignmentType: "兼任",
      costRatio: 30, startDate: "2026-04-01",
    });
    const list = db.assignmentsByEmployee("e2") as any[];
    expect(list.find((a) => a.id === aid)).toBeTruthy();
    // Total cost ratio
    const total = list.reduce((s, a) => s + (a.costRatio || 0), 0);
    expect(total).toBeGreaterThan(0);
  });

  it("deleteAssignment refuses to delete primary", () => {
    const primary = (db.assignmentsByEmployee("e3") as any[]).find((a) => a.isPrimary === 1);
    if (primary) {
      db.deleteAssignment(primary.id);
      // Should still exist
      const after = (db.assignmentsByEmployee("e3") as any[]).find((a) => a.id === primary.id);
      expect(after).toBeTruthy();
    }
  });
});
