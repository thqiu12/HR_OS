import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { filterReminders } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ count: 0, items: [] });

  const all = filterReminders(session, db.reminders());
  const unhandled = all.filter((r: any) => !r.handledAt);
  // Sort: critical → warn → info, then by trigger_date desc
  const sevRank: Record<string, number> = { critical: 0, warn: 1, info: 2 };
  unhandled.sort((a: any, b: any) =>
    (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9) ||
    String(b.triggerDate).localeCompare(String(a.triggerDate))
  );
  return NextResponse.json({
    count: unhandled.length,
    items: unhandled.slice(0, 8).map((r: any) => ({
      id: r.id,
      category: r.category,
      severity: r.severity,
      title: r.title,
      detail: r.detail,
    })),
  });
}
