/**
 * Email service abstraction.
 *
 * Real: Resend (https://resend.com) when RESEND_API_KEY is set.
 * Fallback: console.log so the app works without external services.
 *
 * Env vars:
 *   RESEND_API_KEY — Resend API key
 *   EMAIL_FROM     — sender address (e.g. "HR OS <noreply@your-domain.com>")
 *   EMAIL_REPLY_TO — optional reply-to
 */

import { db } from "./db";

export type SendOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  tag?: string;          // for tracking ("reminder_digest", "test", etc.)
  recipientId?: string;  // user_id or 'cron' for audit
};

export type SendResult =
  | { ok: true; provider: "resend" | "console"; messageId?: string }
  | { ok: false; provider: "resend" | "console"; error: string };

const isConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

export async function sendEmail(opts: SendOptions): Promise<SendResult> {
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];

  if (!isConfigured()) {
    console.log(`[email:console] To=${recipients.join(",")} Subject="${opts.subject}" Tag=${opts.tag || "-"}`);
    if (process.env.EMAIL_DEBUG === "1") {
      console.log(`[email:console] Body:\n${opts.html.replace(/<[^>]+>/g, "")}`);
    }
    recordEmailSend({ to: recipients, subject: opts.subject, tag: opts.tag, status: "console", provider: "console" });
    return { ok: true, provider: "console" };
  }

  try {
    const { Resend } = await import("resend");
    const client = new Resend(process.env.RESEND_API_KEY!);
    const r = await client.emails.send({
      from: process.env.EMAIL_FROM!,
      replyTo: process.env.EMAIL_REPLY_TO,
      to: recipients,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      tags: opts.tag ? [{ name: "tag", value: opts.tag }] : undefined,
    });
    if (r.error) {
      recordEmailSend({ to: recipients, subject: opts.subject, tag: opts.tag, status: "error", provider: "resend", error: r.error.message });
      return { ok: false, provider: "resend", error: r.error.message };
    }
    recordEmailSend({ to: recipients, subject: opts.subject, tag: opts.tag, status: "sent", provider: "resend", messageId: r.data?.id });
    return { ok: true, provider: "resend", messageId: r.data?.id };
  } catch (e: any) {
    recordEmailSend({ to: recipients, subject: opts.subject, tag: opts.tag, status: "error", provider: "resend", error: e?.message || String(e) });
    return { ok: false, provider: "resend", error: e?.message || String(e) };
  }
}

function recordEmailSend(row: {
  to: string[]; subject: string; tag?: string;
  status: string; provider: string; messageId?: string; error?: string;
}) {
  try {
    db.insertEmailLog({
      ts: new Date().toISOString(),
      recipients: row.to.join(","),
      subject: row.subject,
      tag: row.tag || null,
      provider: row.provider,
      status: row.status,
      message_id: row.messageId || null,
      error: row.error || null,
    });
  } catch (e) {
    console.error("[email] failed to record:", e);
  }
}

// ===== Reminder digest template =====
export function buildReminderDigestHtml(opts: {
  recipientName: string;
  reminders: Array<{ category: string; severity: string; title: string; detail: string }>;
  loginUrl: string;
}): string {
  const sevLabel: Record<string, string> = { critical: "🔴 緊急", warn: "🟡 要注意", info: "🔵 通知" };
  const rows = opts.reminders.length === 0
    ? `<p style="color:#64748b">未対応のリマインダーはありません 🎉</p>`
    : opts.reminders.map((r) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;width:80px;font-size:11px">${sevLabel[r.severity] || r.severity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">
            <div style="font-weight:600">${escapeHtml(r.title)}</div>
            <div style="color:#64748b;font-size:11px">${escapeHtml(r.detail)}</div>
          </td>
        </tr>
      `).join("");
  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f8fb;padding:20px;margin:0">
  <div style="max-width:640px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(to right,#4f46e5,#6366f1);color:white;padding:20px 24px">
      <div style="font-weight:700;font-size:18px">HR OS — 本日のリマインダー</div>
      <div style="font-size:12px;opacity:0.9;margin-top:4px">${opts.recipientName} 様</div>
    </div>
    <div style="padding:20px 24px">
      <p style="font-size:13px;color:#334155">${opts.reminders.length}件 の未対応事項があります。</p>
      <table style="width:100%;border-collapse:collapse;margin-top:8px">${rows}</table>
      <div style="margin-top:24px">
        <a href="${opts.loginUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">HR OS で確認する</a>
      </div>
    </div>
    <div style="padding:12px 24px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center">
      このメールは自動配信です。配信停止は管理者にお問い合わせください。
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
