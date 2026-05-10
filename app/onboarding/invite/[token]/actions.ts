"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { verifyInviteToken } from "@/lib/invite-token";
import { logAudit } from "@/lib/audit";
import { saveEncryptedFile } from "@/lib/file-storage";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "application/pdf",
]);
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB per upload

/**
 * Candidate-side upload: saves the file encrypted, then marks the doc as 提出済.
 * Authenticates via the signed invite token only — no session.
 */
export async function uploadDocViaInvite(formData: FormData) {
  const token = String(formData.get("token") || "");
  const docCode = String(formData.get("docCode") || "");
  const file = formData.get("file") as File | null;

  if (!token || !docCode || !file) {
    return { ok: false as const, error: "リクエストが不正です" };
  }

  const v = await verifyInviteToken(token);
  if (v.ok === false) {
    await logAudit({ action: "invite.upload.failed", reason: v.reason, resourceType: "invite_token" });
    return { ok: false as const, error: "招待リンクが無効です" };
  }

  if (file.size === 0) return { ok: false as const, error: "ファイルが空です" };
  if (file.size > MAX_BYTES) return { ok: false as const, error: `ファイルサイズが大きすぎます（最大 ${Math.floor(MAX_BYTES/1024/1024)}MB）` };
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(contentType)) {
    return { ok: false as const, error: "対応していないファイル形式です（JPG/PNG/HEIC/WEBP/PDF）" };
  }

  const c: any = db.onboardingCase(v.caseId);
  if (!c) return { ok: false as const, error: "案件が見つかりません" };
  const doc = (c.docs as any[]).find((d) => d.code === docCode);
  if (!doc) return { ok: false as const, error: "対象書類が見つかりません" };
  if (!["未提出", "差戻し", "提出済"].includes(doc.status)) {
    return { ok: false as const, error: `現在のステータス（${doc.status}）からは提出できません` };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const saved = await saveEncryptedFile({
    scope: `case_${v.caseId}`,
    originalName: file.name,
    contentType,
    data: buf,
  });

  db.insertDocumentFile({
    caseId: v.caseId,
    docCode,
    storageKey: saved.storageKey,
    originalName: saved.originalName,
    contentType: saved.contentType,
    sizeBytes: saved.sizeBytes,
    sha256: saved.sha256,
    uploadedBy: `invite:${v.jti.slice(0, 8)}`,
    iv: saved.iv,
    authTag: saved.authTag,
  });

  // Mark as 提出済 and clear any prior reject reason
  db.updateDocStatus(v.caseId, docCode, "提出済", null);

  await logAudit({
    action: "invite.upload",
    resourceType: "onboarding_document",
    resourceId: `${v.caseId}:${docCode}`,
    after: { fileName: file.name, sizeBytes: file.size, sha256: saved.sha256 },
    user: { loginId: `invite:${v.jti.slice(0, 8)}` },
  });

  revalidatePath(`/onboarding/invite/${token}`);
  revalidatePath(`/onboarding/cases/${v.caseId}`);
  revalidatePath("/onboarding/cases");
  revalidatePath("/dashboard");
  return { ok: true as const, fileName: file.name };
}

// Keep the old marker-only action for backwards compat (if used anywhere)
export async function submitDocViaInvite(token: string, docCode: string) {
  const v = await verifyInviteToken(token);
  if (!v.ok) return { ok: false as const, error: "招待リンクが無効です" };
  const c: any = db.onboardingCase(v.caseId);
  if (!c) return { ok: false as const, error: "案件が見つかりません" };
  const doc = (c.docs as any[]).find((d) => d.code === docCode);
  if (!doc || !["未提出", "差戻し"].includes(doc.status)) {
    return { ok: false as const, error: "提出できません" };
  }
  db.updateDocStatus(v.caseId, docCode, "提出済", null);
  await logAudit({
    action: "invite.submit",
    resourceType: "onboarding_document",
    resourceId: `${v.caseId}:${docCode}`,
    user: { loginId: `invite:${v.jti.slice(0, 8)}` },
  });
  revalidatePath(`/onboarding/invite/${token}`);
  revalidatePath(`/onboarding/cases/${v.caseId}`);
  return { ok: true as const };
}
