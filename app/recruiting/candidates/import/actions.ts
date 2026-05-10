"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canMoveCandidateStage, hasRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { csvToObjects } from "@/lib/csv";
import { randomBytes } from "crypto";

const FLAGS: Record<string, string> = {
  "日本": "🇯🇵", "中国": "🇨🇳", "ベトナム": "🇻🇳", "ネパール": "🇳🇵", "韓国": "🇰🇷",
};
const STAGES = ["応募","書類選考","一次面接","二次面接","条件提示","内定","入社手続き","入社済","不採用"];
const REQUIRED = ["name", "kana", "email", "jobId"];

export type CandImportRow = { rowIndex: number; raw: Record<string, string>; ok: boolean; errors: string[] };

async function ensureCanImport() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (!canMoveCandidateStage(session) && !hasRole(session, "school_hr")) throw new Error("Forbidden");
  return session;
}

export async function previewCandidateCsv(text: string): Promise<{ headers: string[]; rows: CandImportRow[]; ok: number; ng: number }> {
  await ensureCanImport();
  const objs = csvToObjects(text);
  const jobs = db.jobs() as any[];
  const headers = Object.keys(objs[0] || {});

  const rows: CandImportRow[] = objs.map((r, i) => {
    const errors: string[] = [];
    for (const f of REQUIRED) if (!r[f]) errors.push(`${f}: 必須`);
    if (r.jobId && !jobs.some((j) => j.id === r.jobId)) errors.push(`jobId: ${r.jobId} は存在しません`);
    if (r.stage && !STAGES.includes(r.stage)) errors.push(`stage: 無効な値`);
    if (r.email && !r.email.includes("@")) errors.push(`email: 形式エラー`);
    if (r.age && !/^\d+$/.test(r.age)) errors.push(`age: 数値`);
    return { rowIndex: i + 2, raw: r, ok: errors.length === 0, errors };
  });
  return { headers, rows, ok: rows.filter((r) => r.ok).length, ng: rows.filter((r) => !r.ok).length };
}

export async function commitCandidateImport(text: string) {
  const session = await ensureCanImport();
  const preview = await previewCandidateCsv(text);
  let inserted = 0;
  for (const row of preview.rows.filter((r) => r.ok)) {
    const r = row.raw;
    const id = `cand_${randomBytes(5).toString("hex")}`;
    const nationality = r.nationality || "日本";
    db.insertCandidate({
      id,
      name: r.name,
      kana: r.kana,
      flag: FLAGS[nationality] || "🏳",
      nationality,
      jlpt: r.jlpt || null,
      jobId: r.jobId,
      stage: r.stage || "応募",
      attachments: 0,
      appliedAt: r.appliedAt || new Date().toISOString().slice(0, 10),
      email: r.email,
      phone: r.phone || "",
      age: r.age ? Number(r.age) : 0,
      experience: r.experience || "",
      source: r.source || "CSV import",
    });
    inserted++;
  }
  await logAudit({
    session, action: "candidate.csv_import",
    after: { inserted, skipped: preview.ng, total: preview.rows.length },
  });
  revalidatePath("/recruiting/candidates");
  revalidatePath("/recruiting/pipeline");
  revalidatePath("/dashboard");
  return { ok: true as const, inserted, skipped: preview.ng };
}
