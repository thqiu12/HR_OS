import { db } from "./db";
import { headers } from "next/headers";
import type { Session } from "next-auth";

export type AuditEntry = {
  session?: Session | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  before?: any;
  after?: any;
  reason?: string;
  // for unauthenticated paths (login attempt, candidate portal)
  user?: { id?: string | null; loginId?: string | null };
};

/**
 * Persist an audit log row. Safe to call from any server context.
 * Failures are swallowed to never break the user request, but logged to console.
 */
export async function logAudit(e: AuditEntry) {
  try {
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      const h = headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        null;
      ua = h.get("user-agent") ?? null;
    } catch {
      // headers() throws when called outside a request scope (e.g. login attempt)
    }

    const userId = e.session?.user?.id ?? e.user?.id ?? null;
    const userLogin = e.session?.user?.loginId ?? e.user?.loginId ?? null;

    db.insertAudit({
      ts: new Date().toISOString(),
      userId,
      userLogin,
      action: e.action,
      resourceType: e.resourceType ?? null,
      resourceId: e.resourceId ?? null,
      before: e.before === undefined ? null : safeStringify(e.before),
      after: e.after === undefined ? null : safeStringify(e.after),
      ip,
      ua,
      reason: e.reason ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to log:", err, e);
  }
}

function safeStringify(v: any): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
