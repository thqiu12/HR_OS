/**
 * API budget guardrail. Run from cron (or /api/cron/budget if exposed).
 *
 * Compares month-to-date AI API spend against AI_MONTHLY_BUDGET_USD and
 * notifies the configured channels when thresholds (80%, 100%) are crossed.
 *
 * Usage: tsx scripts/check-api-budget.ts
 */

import { db } from "../lib/db";
import { sendEmail } from "../lib/email";
import { alerts } from "../lib/alerts";

const BUDGET = Number(process.env.AI_MONTHLY_BUDGET_USD || 100);
const ALERT_TO = process.env.BUDGET_ALERT_EMAIL || process.env.EMAIL_REPLY_TO || "";

function monthStart(): string {
  const d = new Date();
  d.setDate(1); d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function main() {
  const usage: any[] = db.apiUsageSince(monthStart()) as any[];
  const total = usage.reduce((s, r) => s + (r.costUsd || 0), 0);
  const pct = (total / BUDGET) * 100;
  console.log(`[budget] $${total.toFixed(2)} / $${BUDGET} (${pct.toFixed(1)}%) over ${usage.length} requests`);

  if (pct < 80) return;

  // Webhook (Slack/Discord) — fan out to all configured channels
  await alerts.budgetExceeded(total, BUDGET);

  if (!ALERT_TO) {
    console.warn("[budget] no email recipient configured (BUDGET_ALERT_EMAIL)");
    return;
  }

  const subject = pct >= 100 ? "🚨 AI API 予算超過" : "⚠️ AI API 予算 80% 到達";
  const html = `
    <p>${subject}</p>
    <p>当月利用: <strong>$${total.toFixed(2)}</strong> / 予算 $${BUDGET} (<strong>${pct.toFixed(1)}%</strong>)</p>
    <p>リクエスト数: ${usage.length}</p>
    <p>ダッシュボード: ${process.env.APP_BASE_URL || ""}/settings/metrics</p>
  `;
  await sendEmail({
    to: ALERT_TO,
    subject,
    html,
    text: `${subject}\n\n$${total.toFixed(2)} / $${BUDGET} (${pct.toFixed(1)}%)`,
    tag: "budget.alert",
  });
  console.log(`[budget] alert sent to ${ALERT_TO}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
