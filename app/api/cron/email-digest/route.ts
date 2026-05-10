import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendEmail, buildReminderDigestHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Daily reminder digest. Aggregates unhandled reminders per user (HR + manager
 * roles) and sends a single email per user with their items.
 *
 * Recommended cadence: once per workday at 09:00 (your timezone).
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  const auth = req.headers.get("authorization") || "";
  if (auth.replace(/^Bearer\s+/i, "") !== expected) {
    await logAudit({ action: "cron.email_digest.unauthorized", user: { loginId: "cron" } });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3010";
  const allReminders = (db.reminders() as any[]).filter((r) => !r.handledAt);
  const allUsers = db.allUsers() as any[];
  const allSchools = db.schools() as any[];
  const allDepts = db.departments() as any[];

  const t0 = Date.now();
  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const u of allUsers) {
    if (!u.email || !u.email.includes("@")) { skipped.push(`${u.loginId}:no_email`); continue; }
    const roles = db.rolesByUserId(u.id) as any[];
    // Only send to roles that should care about reminders
    const careful = ["group_admin", "entity_hr", "school_hr", "principal", "manager"].some((r) => roles.some((x) => x.role === r));
    if (!careful) { skipped.push(`${u.loginId}:role`); continue; }

    // Compute the user's accessible school ids (mirrors permissions.accessibleSchoolIds)
    let allowedSchoolIds = new Set<string>();
    if (roles.some((r) => ["group_admin", "executive", "auditor"].includes(r.role))) {
      allSchools.forEach((s) => allowedSchoolIds.add(s.id));
    } else {
      for (const r of roles) {
        if (r.role === "entity_hr" && r.scopeType === "entity") {
          allSchools.filter((s) => s.entity === r.scopeId).forEach((s) => allowedSchoolIds.add(s.id));
        } else if (r.scopeType === "school" && r.scopeId) {
          allowedSchoolIds.add(r.scopeId);
        } else if (r.scopeType === "department" && r.scopeId) {
          const d = allDepts.find((x) => x.id === r.scopeId);
          if (d) allowedSchoolIds.add(d.schoolId);
        }
      }
    }

    const userReminders = allReminders.filter((r) => allowedSchoolIds.has(r.schoolId));
    if (userReminders.length === 0) { skipped.push(`${u.loginId}:no_reminders`); continue; }

    const html = buildReminderDigestHtml({
      recipientName: u.name,
      reminders: userReminders.slice(0, 20),
      loginUrl: `${baseUrl}/reminders`,
    });

    const r = await sendEmail({
      to: u.email,
      subject: `[HR OS] 本日のリマインダー（${userReminders.length}件未対応）`,
      html,
      tag: "reminder_digest",
      recipientId: u.id,
    });
    if (r.ok === true) sent.push(u.loginId);
    else failed.push(`${u.loginId}:${r.error}`);
  }

  const result = { ok: true, sent: sent.length, skipped: skipped.length, failed: failed.length, durationMs: Date.now() - t0 };
  await logAudit({
    action: "cron.email_digest.run",
    user: { loginId: "cron" },
    after: { ...result, sentTo: sent, failed },
  });
  return NextResponse.json(result);
}
