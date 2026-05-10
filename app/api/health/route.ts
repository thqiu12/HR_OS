import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Liveness + readiness probe for load balancers and external monitors.
 *
 * Returns 200 when:
 *  - DB is reachable (single SELECT)
 *  - Uploads directory is writable (file storage works)
 *  - Disk has > 100MB free (won't immediately fill on next upload)
 *
 * Returns 503 with diagnostic JSON if any check fails. Safe to expose
 * publicly: leaks no secrets, only existence/health booleans + disk metrics.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: any }> = {};

  // 1) DB
  try {
    const r: any = db.schools();
    checks.db = { ok: Array.isArray(r), detail: { schools: r.length } };
  } catch (e: any) {
    checks.db = { ok: false, detail: { error: e?.message } };
  }

  // 2) Uploads dir writable
  try {
    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const probe = path.join(uploadsDir, ".health-probe");
    fs.writeFileSync(probe, String(Date.now()));
    fs.unlinkSync(probe);
    checks.uploads = { ok: true };
  } catch (e: any) {
    checks.uploads = { ok: false, detail: { error: e?.message } };
  }

  // 3) Disk free space
  try {
    const stat: any = fs.statfsSync(process.cwd());
    const freeBytes = stat.bavail * stat.bsize;
    const freeMB = Math.round(freeBytes / 1024 / 1024);
    checks.disk = { ok: freeMB > 100, detail: { freeMB } };
  } catch {
    // statfsSync may not be available on all platforms; mark as unknown but don't fail.
    checks.disk = { ok: true, detail: { unsupported: true } };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      ok: allOk,
      ts: new Date().toISOString(),
      version: process.env.npm_package_version || "0.0.0",
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
