"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canMoveCandidateStage, filterCandidates } from "./permissions";
import { logAudit } from "./audit";
import { randomBytes } from "crypto";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

const ROUNDS = ["一次面接", "二次面接", "最終面接", "実技試験"];
const FORMATS = ["online", "offline"];
const STATUSES = ["scheduled", "completed", "cancelled", "no_show"];

export async function scheduleInterviewAction(input: {
  candidateId: string;
  round: string;
  scheduledAt: string;     // ISO
  durationMin?: number;
  format: "online" | "offline";
  location?: string;
  interviewerNames?: string;
}) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!canMoveCandidateStage(session)) throw new AppError(403, "Forbidden");

  const cand = db.candidate(input.candidateId);
  if (!cand) throw new AppError(404, "Candidate not found");
  if (filterCandidates(session, [cand], db.jobs() as any[]).length === 0) {
    throw new AppError(403, "Forbidden: scope");
  }

  if (!ROUNDS.includes(input.round)) throw new AppError(400, "Unknown round");
  if (!FORMATS.includes(input.format)) throw new AppError(400, "Unknown format");
  if (!input.scheduledAt) throw new AppError(400, "scheduledAt is required");

  const id = `iv_${randomBytes(5).toString("hex")}`;
  db.insertInterview({
    id,
    candidateId: input.candidateId,
    round: input.round,
    scheduledAt: input.scheduledAt,
    durationMin: input.durationMin || 60,
    format: input.format,
    location: input.location,
    interviewerNames: input.interviewerNames,
    status: "scheduled",
    createdBy: session.user.id,
  });

  await logAudit({
    session, action: "interview.schedule",
    resourceType: "interview", resourceId: id,
    after: { candidateId: input.candidateId, round: input.round, scheduledAt: input.scheduledAt },
  });
  revalidatePath(`/recruiting/candidates/${input.candidateId}`);
  revalidatePath("/recruiting/interviews");
  revalidatePath("/dashboard");
  return { ok: true as const, id };
}

export async function recordInterviewResultAction(id: string, result: "pass" | "fail" | "hold", feedback: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!canMoveCandidateStage(session)) throw new AppError(403, "Forbidden");
  db.updateInterview(id, { status: "completed", result, feedback });
  await logAudit({
    session, action: "interview.result",
    resourceType: "interview", resourceId: id,
    after: { result },
  });
  revalidatePath("/recruiting/interviews");
  return { ok: true as const };
}

export async function cancelInterviewAction(id: string, reason: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!canMoveCandidateStage(session)) throw new AppError(403, "Forbidden");
  db.updateInterview(id, { status: "cancelled", feedback: reason });
  await logAudit({ session, action: "interview.cancel", resourceType: "interview", resourceId: id, reason });
  revalidatePath("/recruiting/interviews");
  return { ok: true as const };
}
