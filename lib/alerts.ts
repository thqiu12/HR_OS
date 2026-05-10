/**
 * Lightweight alert dispatcher.
 *
 * Sends critical events to Slack / Discord / generic webhook based on env config.
 * Use for things HR/IT must see *now* (PII bulk decrypt, audit chain violation,
 * cron failure, budget alert).
 *
 * Channels (all optional):
 *   SLACK_WEBHOOK_URL           — https://hooks.slack.com/services/...
 *   DISCORD_WEBHOOK_URL         — https://discord.com/api/webhooks/...
 *   GENERIC_WEBHOOK_URL         — any POST endpoint accepting {title, text, severity}
 *
 * Falls back to console.warn when no channel configured.
 */

export type AlertSeverity = "info" | "warning" | "critical";

export type Alert = {
  title: string;
  text: string;
  severity: AlertSeverity;
  context?: Record<string, any>;
};

const COLOR: Record<AlertSeverity, string> = {
  info: "#3b82f6",
  warning: "#f59e0b",
  critical: "#ef4444",
};

const EMOJI: Record<AlertSeverity, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

async function postSlack(url: string, alert: Alert) {
  const body = {
    attachments: [{
      color: COLOR[alert.severity],
      title: `${EMOJI[alert.severity]} ${alert.title}`,
      text: alert.text,
      fields: alert.context
        ? Object.entries(alert.context).map(([title, value]) => ({ title, value: String(value), short: true }))
        : undefined,
      ts: Math.floor(Date.now() / 1000),
    }],
  };
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function postDiscord(url: string, alert: Alert) {
  const colorInt = parseInt(COLOR[alert.severity].slice(1), 16);
  const body = {
    embeds: [{
      title: `${EMOJI[alert.severity]} ${alert.title}`,
      description: alert.text,
      color: colorInt,
      fields: alert.context
        ? Object.entries(alert.context).map(([name, value]) => ({ name, value: String(value), inline: true }))
        : undefined,
      timestamp: new Date().toISOString(),
    }],
  };
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function postGeneric(url: string, alert: Alert) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alert),
  });
}

export async function sendAlert(alert: Alert): Promise<{ ok: boolean; channels: string[] }> {
  const channels: string[] = [];
  const slack = process.env.SLACK_WEBHOOK_URL;
  const discord = process.env.DISCORD_WEBHOOK_URL;
  const generic = process.env.GENERIC_WEBHOOK_URL;

  const promises: Promise<void>[] = [];
  if (slack) { promises.push(postSlack(slack, alert)); channels.push("slack"); }
  if (discord) { promises.push(postDiscord(discord, alert)); channels.push("discord"); }
  if (generic) { promises.push(postGeneric(generic, alert)); channels.push("generic"); }

  if (channels.length === 0) {
    console.warn(`[alert:${alert.severity}] ${alert.title} — ${alert.text}`, alert.context || {});
    return { ok: true, channels: ["console"] };
  }

  try {
    await Promise.all(promises);
    return { ok: true, channels };
  } catch (e) {
    console.error("[alert] failed to dispatch", e);
    return { ok: false, channels };
  }
}

// Convenience presets for common incidents
export const alerts = {
  budgetExceeded: (totalUsd: number, budget: number) =>
    sendAlert({
      severity: "warning",
      title: "AI API 予算 80% 到達",
      text: `当月 $${totalUsd.toFixed(2)} / 予算 $${budget}`,
      context: { url: process.env.APP_BASE_URL + "/settings/metrics" },
    }),
  piiBulkDecrypt: (userLogin: string, count: number) =>
    sendAlert({
      severity: "critical",
      title: "PII大量復号 検知",
      text: `${userLogin} が直近24h で ${count} 件の PII を復号`,
      context: { user: userLogin, count },
    }),
  auditChainViolation: (rowId: number) =>
    sendAlert({
      severity: "critical",
      title: "監査ログ整合性違反",
      text: `audit_logs row ${rowId} のハッシュチェーンが不一致。即時対応必要。`,
      context: { rowId, runbook: process.env.APP_BASE_URL + "/docs/INCIDENT-RESPONSE.md" },
    }),
  cronFailed: (cronName: string, error: string) =>
    sendAlert({
      severity: "warning",
      title: `Cron ジョブ失敗: ${cronName}`,
      text: error,
      context: { cron: cronName },
    }),
  diskLow: (freeMB: number) =>
    sendAlert({
      severity: "critical",
      title: "ディスク残量低下",
      text: `残り ${freeMB} MB`,
      context: { freeMB },
    }),
};
