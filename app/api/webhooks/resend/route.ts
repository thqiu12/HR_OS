import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Resend webhook receiver.
 *
 * Configure in Resend dashboard:
 *   URL: https://your-domain/api/webhooks/resend
 *   Secret: store in env as RESEND_WEBHOOK_SECRET
 *   Events: email.delivered, email.bounced, email.complained, email.delivery_delayed
 *
 * Updates email_logs.status with the latest delivery state for traceability
 * and triggers audit log entries on bounces / complaints.
 *
 * Bypassed by middleware CSRF check (lives under /api/webhooks/*).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const sig = req.headers.get("svix-signature") || req.headers.get("resend-signature") || "";

  const raw = await req.text();

  // Verify signature when secret is configured. Skip in dev for testing.
  if (secret && sig) {
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    try {
      const provided = sig.replace(/^v1,?/, "").trim();
      if (provided.length !== expected.length || !timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"))) {
        await logAudit({ action: "webhook.resend.bad_signature", user: { loginId: "webhook" } });
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid signature format" }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type: string = payload?.type || "";
  const messageId: string | undefined = payload?.data?.email_id || payload?.data?.message_id;
  const recipient: string | undefined = payload?.data?.to?.[0] || payload?.data?.recipient;

  if (!messageId) {
    return NextResponse.json({ ok: true, ignored: "no message_id" });
  }

  let newStatus = "unknown";
  let errorDetail: string | null = null;
  switch (type) {
    case "email.delivered":
      newStatus = "delivered";
      break;
    case "email.bounced":
      newStatus = "bounced";
      errorDetail = payload?.data?.reason || "bounced";
      break;
    case "email.complained":
      newStatus = "complained";
      errorDetail = "user marked as spam";
      break;
    case "email.delivery_delayed":
      newStatus = "delayed";
      break;
    default:
      newStatus = type;
  }

  db.updateEmailLogStatus(messageId, newStatus, errorDetail);

  if (newStatus === "bounced" || newStatus === "complained") {
    await logAudit({
      action: `email.${newStatus}`,
      user: { loginId: "webhook" },
      resourceType: "email",
      resourceId: messageId,
      after: { recipient, error: errorDetail },
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
