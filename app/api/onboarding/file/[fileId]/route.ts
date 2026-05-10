import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { filterOnboardingCases, canApproveOnboarding } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { loadDecryptedFile } from "@/lib/file-storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { fileId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canApproveOnboarding(session)) {
    await logAudit({ session, action: "document.download.denied", resourceType: "document_file", resourceId: params.fileId, reason: "role" });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fid = Number(params.fileId);
  if (!Number.isInteger(fid)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const row: any = db.documentFile(fid);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const c: any = db.onboardingCase(row.caseId);
  if (!c || filterOnboardingCases(session, [c]).length === 0) {
    await logAudit({ session, action: "document.download.denied", resourceType: "document_file", resourceId: String(fid), reason: "scope" });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let data: Buffer;
  try {
    data = await loadDecryptedFile(row);
  } catch (e: any) {
    await logAudit({ session, action: "document.download.failed", resourceType: "document_file", resourceId: String(fid), reason: e?.message || "decrypt_failed" });
    return NextResponse.json({ error: "File error" }, { status: 500 });
  }

  await logAudit({
    session,
    action: "document.download",
    resourceType: "document_file",
    resourceId: String(fid),
    after: { caseId: row.caseId, docCode: row.docCode, sizeBytes: row.sizeBytes, sha256: row.sha256 },
  });

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": row.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
