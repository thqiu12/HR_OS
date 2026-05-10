import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canViewEmployee } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { loadDecryptedFile } from "@/lib/file-storage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { fileId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fid = Number(params.fileId);
  if (!Number.isInteger(fid)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const row: any = db.reviewFile(fid);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const review: any = db.reviewById(row.reviewId);
  const emp = review ? db.employee(review.employeeId) : null;
  if (!emp || !canViewEmployee(session, emp)) {
    await logAudit({ session, action: "review.file.download.denied", resourceType: "review_file", resourceId: String(fid), reason: "scope" });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let data: Buffer;
  try { data = await loadDecryptedFile(row); }
  catch (e: any) {
    return NextResponse.json({ error: "File error" }, { status: 500 });
  }

  await logAudit({
    session, action: "review.file.download",
    resourceType: "review_file", resourceId: String(fid),
    after: { reviewId: row.reviewId, kind: row.fileKind, sizeBytes: row.sizeBytes },
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
