"use server";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { auth } from "@/auth";
import {
  canMoveCandidateStage,
  canApproveOnboarding,
  canHandleReminder,
  filterCandidates,
  filterOnboardingCases,
  hasRole,
} from "./permissions";
import { logAudit } from "./audit";
import { regenerateReminders } from "./reminder-generator";

class AuthError extends Error {
  constructor(public code: number, msg: string) { super(msg); }
}

async function requireSession() {
  const session = await auth();
  if (!session) throw new AuthError(401, "Unauthorized");
  return session;
}

const STAGES = ["応募","書類選考","一次面接","二次面接","条件提示","内定","入社手続き","入社済","不採用"];

const NEW_DOCS_SHINSOTSU = [
  { code: "zairyu_card", name: "在留カード（両面カラーコピー）" },
  { code: "mynumber_card", name: "マイナンバーカード（両面）または住民票" },
  { code: "bank_card", name: "給与振込口座（キャッシュカード両面）" },
];
const NEW_DOCS_CHUTO_EXTRA = [
  { code: "rishoku_shomei", name: "離職証明書" },
  { code: "koyo_hoken", name: "雇用保険被保険者証" },
  { code: "gensen_choshu", name: "前職の源泉徴収票" },
];

export async function moveCandidateStage(id: string, stage: string) {
  const session = await requireSession();
  if (!STAGES.includes(stage)) throw new AuthError(400, `Unknown stage: ${stage}`);

  if (!canMoveCandidateStage(session)) {
    await logAudit({ session, action: "candidate.move_stage.denied", resourceType: "candidate", resourceId: id, reason: "role" });
    throw new AuthError(403, "Forbidden: role");
  }

  const cand = db.candidate(id) as any;
  if (!cand) throw new AuthError(404, "Candidate not found");
  const job = cand.jobId ? (db.job(cand.jobId) as any) : null;

  if (filterCandidates(session, [cand], db.jobs() as any[]).length === 0) {
    await logAudit({ session, action: "candidate.move_stage.denied", resourceType: "candidate", resourceId: id, reason: "scope" });
    throw new AuthError(403, "Forbidden: scope");
  }

  const before = { stage: cand.stage };
  db.updateCandidateStage(id, stage);

  // Auto-create onboarding case when stage advances to 入社手続き (idempotent)
  let createdOnboardingCaseId: string | null = null;
  if (stage === "入社手続き" && job) {
    const exists = db.onboardingCaseExistsForCandidate(cand.name, job.schoolId);
    if (!exists) {
      const caseId = `o_${Math.random().toString(16).slice(2, 10)}`;
      const route = job.route as "新卒" | "中途";
      // Default expected join date: 1st of next month
      const next = new Date(); next.setMonth(next.getMonth() + 1, 1);
      const expectedJoinDate = next.toISOString().slice(0, 10);
      db.insertOnboardingCase({
        id: caseId,
        candidateName: cand.name,
        flag: cand.flag,
        schoolId: job.schoolId,
        position: job.title,
        route,
        expectedJoinDate,
        status: "未開始",
      });
      const docs = route === "新卒" ? NEW_DOCS_SHINSOTSU : [...NEW_DOCS_SHINSOTSU, ...NEW_DOCS_CHUTO_EXTRA];
      docs.forEach((d, i) => db.insertOnboardingDocument({
        caseId, docCode: d.code, docName: d.name, required: true, status: "未提出", ord: i,
      }));
      createdOnboardingCaseId = caseId;
      await logAudit({
        session, action: "onboarding.case.auto_create",
        resourceType: "onboarding_case", resourceId: caseId,
        after: { candidateId: id, route, schoolId: job.schoolId },
      });
    }
  }

  await logAudit({
    session,
    action: "candidate.move_stage",
    resourceType: "candidate",
    resourceId: id,
    before,
    after: { stage, createdOnboardingCaseId },
  });

  revalidatePath("/recruiting/pipeline");
  revalidatePath(`/recruiting/candidates/${id}`);
  revalidatePath("/onboarding/cases");
  revalidatePath("/dashboard");
  return { ok: true as const, createdOnboardingCaseId };
}

export async function rejectCandidate(id: string, reason: string) {
  const session = await requireSession();
  if (!canMoveCandidateStage(session)) {
    throw new AuthError(403, "Forbidden");
  }
  const cand = db.candidate(id) as any;
  if (!cand) throw new AuthError(404, "Candidate not found");
  if (filterCandidates(session, [cand], db.jobs() as any[]).length === 0) {
    throw new AuthError(403, "Forbidden: scope");
  }
  db.updateCandidateStage(id, "不採用");
  await logAudit({
    session, action: "candidate.reject",
    resourceType: "candidate", resourceId: id,
    before: { stage: cand.stage }, after: { stage: "不採用" }, reason,
  });
  revalidatePath("/recruiting/pipeline");
  revalidatePath(`/recruiting/candidates/${id}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

const STAGE_FORWARD: Record<string, string> = {
  "応募": "書類選考",
  "書類選考": "一次面接",
  "一次面接": "二次面接",
  "二次面接": "条件提示",
  "条件提示": "内定",
  "内定": "入社手続き",
  "入社手続き": "入社済",
};

export async function advanceCandidateStage(id: string) {
  const session = await requireSession();
  const cand = db.candidate(id) as any;
  if (!cand) throw new AuthError(404, "Candidate not found");
  const next = STAGE_FORWARD[cand.stage];
  if (!next) throw new AuthError(400, `これ以上進めません（現在：${cand.stage}）`);
  return moveCandidateStage(id, next);
}

export async function setDocStatus(caseId: string, docCode: string, status: string, rejectReason?: string) {
  const session = await requireSession();

  if (!canApproveOnboarding(session)) {
    await logAudit({ session, action: "onboarding.set_doc.denied", resourceType: "onboarding_case", resourceId: caseId, reason: "role" });
    throw new AuthError(403, "Forbidden: role");
  }

  const oc = db.onboardingCase(caseId) as any;
  if (!oc) throw new AuthError(404, "Case not found");

  if (filterOnboardingCases(session, [oc]).length === 0) {
    await logAudit({ session, action: "onboarding.set_doc.denied", resourceType: "onboarding_case", resourceId: caseId, reason: "scope" });
    throw new AuthError(403, "Forbidden: scope");
  }

  const beforeDoc = (oc.docs as any[]).find((d: any) => d.code === docCode);
  db.updateDocStatus(caseId, docCode, status, rejectReason ?? null);
  await logAudit({
    session,
    action: "onboarding.set_doc",
    resourceType: "onboarding_document",
    resourceId: `${caseId}:${docCode}`,
    before: { status: beforeDoc?.status, rejectReason: beforeDoc?.rejectReason },
    after: { status, rejectReason: rejectReason ?? null },
  });

  revalidatePath(`/onboarding/cases/${caseId}`);
  revalidatePath("/onboarding/cases");
  revalidatePath("/dashboard");
}

export async function regenerateRemindersAction() {
  const session = await requireSession();
  if (!hasRole(session, "group_admin") && !hasRole(session, "entity_hr")) {
    await logAudit({ session, action: "reminder.regenerate.denied", reason: "role" });
    throw new AuthError(403, "Forbidden");
  }
  const result = regenerateReminders(session.user.loginId || session.user.id);
  await logAudit({
    session,
    action: "reminder.regenerate",
    after: result,
  });
  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return result;
}

export async function setReminderHandled(id: string, handled: boolean) {
  const session = await requireSession();
  const r = db.reminder(id);
  if (!r) throw new AuthError(404, "Reminder not found");

  if (!canHandleReminder(session, r)) {
    await logAudit({ session, action: "reminder.set_handled.denied", resourceType: "reminder", resourceId: id, reason: "scope" });
    throw new AuthError(403, "Forbidden");
  }

  if (handled) {
    db.markReminderHandled(id, session.user.loginId);
  } else {
    db.unmarkReminderHandled(id);
  }

  await logAudit({
    session,
    action: handled ? "reminder.handled" : "reminder.unhandled",
    resourceType: "reminder",
    resourceId: id,
  });

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
}
