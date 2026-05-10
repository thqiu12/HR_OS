import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasRole } from "@/lib/permissions";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/** Admin-only test endpoint that throws an error so Sentry config can be verified. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !hasRole(session, "group_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const err = new Error(`Sentry test from /api/sentry-test at ${new Date().toISOString()}`);
  await captureError(err, { source: "sentry-test", user: session.user.loginId });
  return NextResponse.json({
    ok: true,
    captured: !!process.env.SENTRY_DSN,
    note: process.env.SENTRY_DSN ? "Error sent to Sentry" : "SENTRY_DSN not set — error logged to console only",
  });
}
