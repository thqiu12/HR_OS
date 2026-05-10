import { NextRequest, NextResponse } from "next/server";
import { regenerateReminders } from "@/lib/reminder-generator";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: regenerate the auto-generated reminder set.
 *
 * Auth via Bearer token from CRON_SECRET. Designed for external schedulers
 * (Fly.io scheduled-machines, GitHub Actions, Vercel Cron, etc.).
 *
 * Recommended cadence: every 1 hour. Idempotent — calling more often is
 * harmless (just wasted DB work).
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token !== expected) {
    await logAudit({ action: "cron.reminders.unauthorized", user: { loginId: "cron" } });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = regenerateReminders("cron");
  await logAudit({
    action: "cron.reminders.run",
    user: { loginId: "cron" },
    after: result,
  });

  return NextResponse.json({ ok: true, ...result });
}

// GET for liveness checks
export async function GET() {
  return NextResponse.json({ ok: true, message: "POST with Bearer CRON_SECRET to regenerate reminders" });
}
