import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasRole } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session, "group_admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const to = body.to || session.user.email;
  if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });

  const r = await sendEmail({
    to,
    subject: "[HR OS] テストメール",
    html: `<p>これは HR OS からのテストメールです。</p><p>送信時刻: ${new Date().toISOString()}</p>`,
    tag: "test",
  });
  return NextResponse.json(r);
}
