import { NextRequest, NextResponse } from "next/server";
import { runRetention } from "@/lib/retention";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: enforce data retention policy.
 *
 * Auth via Bearer token from CRON_SECRET. Recommended cadence: daily at 03:00.
 * Idempotent — only acts on rows that crossed a threshold since last run.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token !== expected) {
    await logAudit({ action: "cron.retention.unauthorized", user: { loginId: "cron" } });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runRetention();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST with Bearer CRON_SECRET to run retention" });
}
