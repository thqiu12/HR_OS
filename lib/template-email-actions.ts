"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "./db";
import { canMoveCandidateStage, filterCandidates } from "./permissions";
import { logAudit } from "./audit";
import { sendEmail } from "./email";
import { TEMPLATES, type TemplateName } from "./email-templates";

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

/** Send a templated email to a candidate. Auto-builds template payload from DB. */
export async function sendCandidateTemplateEmail(input: {
  candidateId: string;
  template: TemplateName;
  customSubject?: string;
  // For jobOffer template:
  salary?: string;
  startDate?: string;
  deadline?: string;
}) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  if (!canMoveCandidateStage(session)) throw new AppError(403, "Forbidden");

  const cand: any = db.candidate(input.candidateId);
  if (!cand) throw new AppError(404, "Candidate not found");
  if (filterCandidates(session, [cand], db.jobs() as any[]).length === 0) {
    throw new AppError(403, "Forbidden: scope");
  }
  if (!cand.email) throw new AppError(400, "候補者にメールアドレスが登録されていません");

  const job: any = db.job(cand.jobId);
  const school: any = job ? db.schoolById(job.schoolId) : null;
  const schoolName = school?.name || "弊社";
  const jobTitle = job?.title || "（求人）";

  let payload: { subject: string; html: string; text: string };
  switch (input.template) {
    case "applicationReceived":
      payload = TEMPLATES.applicationReceived({ candidateName: cand.name, jobTitle, schoolName });
      break;
    case "jobOffer":
      payload = TEMPLATES.jobOffer({
        candidateName: cand.name, jobTitle, schoolName,
        salary: input.salary, startDate: input.startDate, deadline: input.deadline,
      });
      break;
    case "rejection":
      payload = TEMPLATES.rejection({ candidateName: cand.name, jobTitle, schoolName });
      break;
    case "interviewSchedule": {
      const interviews = db.interviewsByCandidate(cand.id) as any[];
      const next = interviews.filter((iv) => iv.status === "scheduled").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
      if (!next) throw new AppError(400, "予定の面接が見つかりません。先に面接を設定してください");
      payload = TEMPLATES.interviewSchedule({
        candidateName: cand.name, round: next.round, scheduledAt: next.scheduledAt,
        format: next.format, location: next.location || "", durationMin: next.durationMin,
        interviewers: next.interviewerNames || "",
      });
      break;
    }
    case "onboardingReminder":
      throw new AppError(400, "onboardingReminder は候補者ではなく入社案件に対して送信してください");
    default:
      throw new AppError(400, `Unknown template: ${input.template}`);
  }

  const r = await sendEmail({
    to: cand.email,
    subject: input.customSubject || payload.subject,
    html: payload.html,
    text: payload.text,
    tag: `candidate.${input.template}`,
    recipientId: cand.id,
  });
  await logAudit({
    session, action: `candidate.email.${input.template}`,
    resourceType: "candidate", resourceId: cand.id,
    after: { to: cand.email, subject: payload.subject, ok: r.ok, provider: r.provider },
  });
  revalidatePath(`/recruiting/candidates/${cand.id}`);
  return { ok: r.ok, provider: r.provider, subject: payload.subject };
}

export async function sendOnboardingReminderEmail(caseId: string, portalUrl: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const c: any = db.onboardingCase(caseId);
  if (!c) throw new AppError(404, "Case not found");
  // Recipient: derived from invite email (we don't have this for the demo)
  // For now require it as input or skip
  return { ok: false as const, error: "Not implemented" };
}

