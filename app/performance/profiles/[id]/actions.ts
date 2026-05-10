"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canCreateReviewFor, canViewEmployee } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { saveEncryptedFile } from "@/lib/file-storage";
import { randomBytes } from "crypto";

const ALLOWED_DOC_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024;

export async function uploadReviewFileAction(formData: FormData) {
  const session = await auth();
  if (!session) return { ok: false as const, error: "Unauthorized" };
  const reviewId = String(formData.get("reviewId") || "");
  const fileKind = String(formData.get("fileKind") || "self");
  const file = formData.get("file") as File | null;
  if (!reviewId || !file) return { ok: false as const, error: "リクエストが不正です" };
  if (!["self", "manager"].includes(fileKind)) return { ok: false as const, error: "fileKind must be self|manager" };

  const review: any = db.reviewById(reviewId);
  if (!review) return { ok: false as const, error: "評価が見つかりません" };
  const emp = db.employee(review.employeeId);
  if (!emp || !canCreateReviewFor(session, emp)) {
    await logAudit({ session, action: "review.file.upload.denied", resourceType: "review", resourceId: reviewId, reason: "scope" });
    return { ok: false as const, error: "アクセス権限がありません" };
  }

  if (file.size === 0) return { ok: false as const, error: "ファイルが空です" };
  if (file.size > MAX_BYTES) return { ok: false as const, error: `最大 ${Math.floor(MAX_BYTES/1024/1024)}MB` };
  const contentType = file.type || "application/pdf";
  if (!ALLOWED_DOC_TYPES.has(contentType)) return { ok: false as const, error: "PDF / JPG / PNG / HEIC / WEBP のみ" };

  const buf = Buffer.from(await file.arrayBuffer());
  const saved = await saveEncryptedFile({
    scope: `review_${reviewId}`,
    originalName: file.name,
    contentType,
    data: buf,
  });
  db.insertReviewFile({
    reviewId, fileKind, storageKey: saved.storageKey,
    originalName: saved.originalName, contentType: saved.contentType,
    sizeBytes: saved.sizeBytes, sha256: saved.sha256,
    uploadedBy: session.user.id, iv: saved.iv, authTag: saved.authTag,
  });
  await logAudit({
    session, action: "review.file.upload",
    resourceType: "review_file", resourceId: `${reviewId}:${fileKind}`,
    after: { fileName: file.name, sizeBytes: file.size, sha256: saved.sha256 },
  });
  revalidatePath(`/performance/profiles/${review.employeeId}`);
  return { ok: true as const, fileName: file.name };
}

const VALID_TYPES = new Set(["試用期間評価", "年度評価", "昇格評価", "給与改定"]);

export async function createReviewAction(input: {
  employeeId: string;
  type: string;
  periodLabel: string;
  dueDate: string;       // YYYY-MM-DD
  evaluator: string;     // free text — the reviewer's name
  rating?: string | null;
  result?: string;
  fromReminderId?: string;  // when launched from a reminder, mark it handled
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (!VALID_TYPES.has(input.type)) throw new Error(`Invalid review type: ${input.type}`);

  const emp = db.employee(input.employeeId);
  if (!emp) throw new Error("Employee not found");
  if (!canCreateReviewFor(session, emp)) {
    await logAudit({ session, action: "performance.review.create.denied", resourceType: "employee", resourceId: input.employeeId, reason: "scope" });
    throw new Error("Forbidden");
  }

  const id = `r_${randomBytes(6).toString("hex")}`;
  db.insertReview({
    id,
    employeeId: input.employeeId,
    type: input.type,
    periodLabel: input.periodLabel,
    dueDate: input.dueDate,
    rating: input.rating ?? null,
    result: input.result || "（未記載）",
    evaluator: input.evaluator,
    status: input.rating ? "完了" : "予定",
  });

  await logAudit({
    session,
    action: "performance.review.create",
    resourceType: "review",
    resourceId: id,
    after: { employeeId: input.employeeId, type: input.type, dueDate: input.dueDate, rating: input.rating ?? null },
  });

  // If launched from a reminder, mark it handled
  if (input.fromReminderId) {
    const reminder = db.reminder(input.fromReminderId);
    if (reminder) {
      db.markReminderHandled(input.fromReminderId, session.user.loginId || "system");
      await logAudit({ session, action: "reminder.handled", resourceType: "reminder", resourceId: input.fromReminderId, reason: "via review creation" });
      revalidatePath("/reminders");
    }
  }

  revalidatePath(`/performance/profiles/${input.employeeId}`);
  revalidatePath("/dashboard");
  return { ok: true as const, id };
}
