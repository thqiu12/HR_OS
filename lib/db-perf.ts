/**
 * DB performance instrumentation.
 *
 * Wraps better-sqlite3 prepare() to log slow queries (> SLOW_QUERY_MS) with
 * EXPLAIN QUERY PLAN. Run analyzeQueries() from a script or admin route to
 * identify N+1 patterns or missing indexes.
 */

import type Database from "better-sqlite3";

const SLOW_QUERY_MS = Number(process.env.HR_SLOW_QUERY_MS || 50);

type SlowQueryEntry = {
  sql: string;
  durationMs: number;
  ts: string;
  plan?: string[];
};

const slowQueries: SlowQueryEntry[] = [];
const MAX_SLOW_LOG = 500;

export function recordSlowQuery(sql: string, durationMs: number, plan?: string[]) {
  if (durationMs < SLOW_QUERY_MS) return;
  slowQueries.push({ sql: sql.slice(0, 500), durationMs, ts: new Date().toISOString(), plan });
  if (slowQueries.length > MAX_SLOW_LOG) slowQueries.shift();
  console.warn(`[slow-query] ${durationMs}ms ${sql.slice(0, 100)}`);
}

export function recentSlowQueries(): SlowQueryEntry[] {
  return [...slowQueries].reverse();
}

export function clearSlowQueries() {
  slowQueries.length = 0;
}

/** Run EXPLAIN QUERY PLAN for every distinct query the app uses (read from db.ts). */
export function analyzeQueries(conn: Database.Database) {
  const queries = [
    // Hot reads
    { name: "candidates_by_stage", sql: "SELECT * FROM candidates WHERE stage = ?" },
    { name: "candidates_by_job", sql: "SELECT * FROM candidates WHERE job_id = ?" },
    { name: "employees_by_school", sql: "SELECT * FROM employees WHERE school_id = ?" },
    { name: "employees_by_dept", sql: "SELECT * FROM employees WHERE department_id = ?" },
    { name: "reviews_by_emp", sql: "SELECT * FROM reviews WHERE employee_id = ? ORDER BY due_date" },
    { name: "reminders_handled_filter", sql: "SELECT * FROM reminders WHERE handled_at IS NULL" },
    { name: "audit_recent", sql: "SELECT * FROM audit_logs ORDER BY ts DESC LIMIT 50" },
    { name: "interviews_upcoming", sql: "SELECT * FROM interviews WHERE status = 'scheduled' AND scheduled_at > datetime('now')" },
    { name: "items_by_review", sql: "SELECT * FROM review_items WHERE review_id = ? ORDER BY category, ord" },
  ];

  const results: Array<{ name: string; plan: string[] }> = [];
  for (const q of queries) {
    try {
      const planRows = conn.prepare(`EXPLAIN QUERY PLAN ${q.sql}`).all(...new Array(q.sql.match(/\?/g)?.length || 0).fill("dummy"));
      const plan = planRows.map((r: any) => r.detail);
      results.push({ name: q.name, plan });
    } catch (e: any) {
      results.push({ name: q.name, plan: [`error: ${e.message}`] });
    }
  }
  return results;
}
