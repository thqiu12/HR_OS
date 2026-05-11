"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { filterCandidates } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { saveEncryptedFile, loadDecryptedFile } from "@/lib/file-storage";
import { parseResumeFromPdf, mockParsedResume } from "@/lib/anthropic";
import { recordApiUsage } from "@/lib/api-usage";

const ALLOWED_TYPES = new Set(["application/pdf"]);
const MAX_BYTES = 15 * 1024 * 1024;

class AppError extends Error { constructor(public code: number, msg: string) { super(msg); } }

async function requireSessionForCandidate(candidateId: string) {
  const session = await auth();
  if (!session) throw new AppError(401, "Unauthorized");
  const c = db.candidate(candidateId);
  if (!c) throw new AppError(404, "Candidate not found");
  if (filterCandidates(session, [c], db.jobs() as any[]).length === 0) {
    await logAudit({ session, action: "candidate.access.denied", resourceType: "candidate", resourceId: candidateId, reason: "scope" });
    throw new AppError(403, "Forbidden");
  }
  return { session, candidate: c };
}

export async function uploadResume(formData: FormData) {
  const candidateId = String(formData.get("candidateId") || "");
  const file = formData.get("file") as File | null;
  if (!candidateId || !file) return { ok: false as const, error: "リクエストが不正です" };

  const { session } = await requireSessionForCandidate(candidateId);

  if (file.size === 0) return { ok: false as const, error: "ファイルが空です" };
  if (file.size > MAX_BYTES) return { ok: false as const, error: `最大 ${Math.floor(MAX_BYTES/1024/1024)}MBまで` };
  const contentType = file.type || "application/pdf";
  if (!ALLOWED_TYPES.has(contentType)) return { ok: false as const, error: "PDFのみアップロード可能です" };

  const buf = Buffer.from(await file.arrayBuffer());
  const saved = await saveEncryptedFile({
    scope: `candidate_${candidateId}`,
    originalName: file.name,
    contentType,
    data: buf,
  });

  db.insertCandidateFile({
    candidateId,
    storageKey: saved.storageKey,
    originalName: saved.originalName,
    contentType: saved.contentType,
    sizeBytes: saved.sizeBytes,
    sha256: saved.sha256,
    uploadedBy: session.user.id,
    iv: saved.iv,
    authTag: saved.authTag,
    isResume: true,
  });

  await logAudit({
    session,
    action: "candidate.resume.upload",
    resourceType: "candidate",
    resourceId: candidateId,
    after: { fileName: file.name, sizeBytes: file.size, sha256: saved.sha256 },
  });

  revalidatePath(`/recruiting/candidates/${candidateId}`);
  return { ok: true as const, fileName: file.name };
}

export async function parseResumeAction(candidateId: string) {
  const { session } = await requireSessionForCandidate(candidateId);

  const resume: any = db.candidateLatestResume(candidateId);
  if (!resume) return { ok: false as const, error: "履歴書がアップロードされていません" };

  let pdf: Buffer;
  try { pdf = await loadDecryptedFile(resume); }
  catch { return { ok: false as const, error: "履歴書ファイルの読み込みに失敗しました" }; }

  db.setCandidateAiParsed(candidateId, { status: "pending" });
  await logAudit({ session, action: "candidate.resume.parse.start", resourceType: "candidate", resourceId: candidateId });

  const t0 = Date.now();
  const result = await parseResumeFromPdf(pdf);
  const durationMs = Date.now() - t0;

  if (result.ok === false) {
    if (result.reason === "no_api_key") {
      // Do NOT overwrite existing parsed data with mock — that would destroy
      // local-parse results. Return an explicit error instead.
      await logAudit({ session, action: "candidate.resume.parse.skipped", resourceType: "candidate", resourceId: candidateId, reason: "no_api_key" });
      return {
        ok: false as const,
        error: "AI解析を使うには .env に ANTHROPIC_API_KEY を設定してください。設定なしでも「ローカル解析 (無料)」 が利用可能です。",
      };
    }
    db.setCandidateAiParsed(candidateId, { status: "error" });
    recordApiUsage({
      model: process.env.ANTHROPIC_RESUME_MODEL || "claude-opus-4-7",
      feature: "resume_parse", status: "error",
      userId: session.user.id, userLogin: session.user.loginId,
      resourceType: "candidate", resourceId: candidateId, durationMs,
      error: result.message || result.reason,
    });
    await logAudit({ session, action: "candidate.resume.parse.failed", resourceType: "candidate", resourceId: candidateId, reason: result.message || result.reason });
    return { ok: false as const, error: result.message || "解析に失敗しました" };
  }

  db.setCandidateAiParsed(candidateId, {
    status: "done",
    data: JSON.stringify(result.data),
    model: result.model,
  });
  const cost = recordApiUsage({
    model: result.model, feature: "resume_parse", status: "success",
    userId: session.user.id, userLogin: session.user.loginId,
    resourceType: "candidate", resourceId: candidateId, durationMs,
    inputTokens: result.tokensIn, outputTokens: result.tokensOut,
    cacheCreationTokens: (result as any).cacheCreationTokens || 0,
    cacheReadTokens: (result as any).cacheReadTokens || 0,
  });
  await logAudit({
    session,
    action: "candidate.resume.parse.success",
    resourceType: "candidate",
    resourceId: candidateId,
    after: { model: result.model, tokensIn: result.tokensIn, tokensOut: result.tokensOut, costUsd: cost.toFixed(6) },
  });
  revalidatePath(`/recruiting/candidates/${candidateId}`);
  return { ok: true as const, mock: false, model: result.model, tokensIn: result.tokensIn, tokensOut: result.tokensOut, costUsd: cost };
}

/**
 * Zero-cost local resume parser. No external API call.
 *
 * Reads PDF text via pdf-parse + applies Japanese 履歴書 regex/heuristics.
 * Saves to the same candidate_ai_parsed JSON column so the existing
 * "解析結果プレビュー" UI displays it. Coverage score is also stored
 * (in `notes`-style metadata) so HR can see how reliable the result is.
 */
export async function parseResumeLocalAction(candidateId: string) {
  const { session } = await requireSessionForCandidate(candidateId);
  const resume: any = db.candidateLatestResume(candidateId);
  if (!resume) return { ok: false as const, error: "履歴書がアップロードされていません" };

  let pdf: Buffer;
  try { pdf = await loadDecryptedFile(resume); }
  catch { return { ok: false as const, error: "履歴書ファイルの読み込みに失敗しました" }; }

  db.setCandidateAiParsed(candidateId, { status: "pending" });
  await logAudit({ session, action: "candidate.resume.parse.local.start", resourceType: "candidate", resourceId: candidateId });

  const t0 = Date.now();
  const { parseResumeLocal } = await import("@/lib/resume-parser-local");
  const result = await parseResumeLocal(pdf);
  const durationMs = Date.now() - t0;

  if (result.ok === false) {
    db.setCandidateAiParsed(candidateId, { status: "error" });
    recordApiUsage({
      model: "local", feature: "resume_parse", status: "error",
      userId: session.user.id, userLogin: session.user.loginId,
      resourceType: "candidate", resourceId: candidateId, durationMs,
      error: result.message,
    });
    await logAudit({ session, action: "candidate.resume.parse.local.failed", resourceType: "candidate", resourceId: candidateId, reason: result.message });
    return { ok: false as const, error: result.message + (result.reason === "empty_text" ? " — AI解析を試してください" : "") };
  }

  db.setCandidateAiParsed(candidateId, {
    status: "done",
    data: JSON.stringify({ ...result.data, _coverage: result.coverage, _source: "local" }),
    model: "local",
  });
  recordApiUsage({
    model: "local", feature: "resume_parse", status: "success",
    userId: session.user.id, userLogin: session.user.loginId,
    resourceType: "candidate", resourceId: candidateId, durationMs,
  });
  await logAudit({
    session, action: "candidate.resume.parse.local.success",
    resourceType: "candidate", resourceId: candidateId,
    after: { coverage: Math.round(result.coverage * 100) + "%", durationMs },
  });
  revalidatePath(`/recruiting/candidates/${candidateId}`);
  return { ok: true as const, coverage: result.coverage };
}
