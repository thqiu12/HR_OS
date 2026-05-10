/**
 * PII / data retention policy.
 *
 * Defines how long different categories of personal data are kept after the
 * triggering event (resignation, candidate rejection, etc.). Run via the
 * /api/cron/retention endpoint, ideally daily.
 *
 * Defaults are conservative — adjust per your jurisdiction and HR policy.
 *
 * 法的参考:
 *  - 労基法: 雇用関係書類は退職後5年保存 (2020改正で3年→5年)
 *  - 個人情報保護法: 利用目的達成後は遅滞なく消去
 *  - 出入国管理: 雇用主は在留カード写し3年保存 (永住者などは制限あり)
 */

import { db } from "./db";
import { logAudit } from "./audit";

export type RetentionRun = {
  candidatesRejectedPurged: number;
  candidatesRejectedAnonymized: number;
  resignedPiiCleared: number;
  oldUploadsRemoved: number;
};

/** Days to keep PII for: rejected candidates after rejection date. */
const REJECTED_CAND_PII_DAYS = 90;
/** Days after which to fully delete a rejected candidate (incl. files). */
const REJECTED_CAND_PURGE_DAYS = 365;
/** Days after employee status="退職" to clear PII (myNumber, bankAccount, passportNo). */
const RESIGNED_PII_CLEAR_DAYS = 365 * 5; // labor-law minimum

export async function runRetention(): Promise<RetentionRun> {
  const result: RetentionRun = {
    candidatesRejectedPurged: 0,
    candidatesRejectedAnonymized: 0,
    resignedPiiCleared: 0,
    oldUploadsRemoved: 0,
  };

  const now = new Date();
  const isoMinus = (days: number) =>
    new Date(now.getTime() - days * 86400_000).toISOString().slice(0, 10);

  // 1) Anonymize rejected candidates older than REJECTED_CAND_PII_DAYS
  const anonCutoff = isoMinus(REJECTED_CAND_PII_DAYS);
  const candidates = db.candidates() as any[];
  for (const c of candidates) {
    if (c.stage !== "不採用") continue;
    if (String(c.appliedAt) > anonCutoff) continue;
    if (c.email === "" && c.phone === "") continue; // already anonymized
    db.anonymizeCandidate(c.id);
    result.candidatesRejectedAnonymized++;
  }

  // 2) Hard-delete rejected candidates older than REJECTED_CAND_PURGE_DAYS
  const purgeCutoff = isoMinus(REJECTED_CAND_PURGE_DAYS);
  for (const c of candidates) {
    if (c.stage !== "不採用") continue;
    if (String(c.appliedAt) > purgeCutoff) continue;
    db.deleteCandidate(c.id);
    result.candidatesRejectedPurged++;
  }

  // 3) Clear PII from resigned employees older than RESIGNED_PII_CLEAR_DAYS
  // (We keep the employee record itself for HR-history purposes — only PII fields are cleared.)
  const resignedCutoff = isoMinus(RESIGNED_PII_CLEAR_DAYS);
  const employees = db.employees() as any[];
  for (const e of employees) {
    if (e.status !== "退職") continue;
    // Use updated_at if available; fall back to hireDate as a worst-case anchor
    const anchor = String(e.updatedAt || e.hireDate);
    if (anchor > resignedCutoff) continue;
    const ct = db.getEmployeePiiCiphertext(e.id);
    if (!ct || (!ct.myNumberEnc && !ct.bankAccountEnc && !ct.passportNoEnc)) continue;
    db.setEmployeePii(e.id, { myNumberEnc: null, bankAccountEnc: null, passportNoEnc: null });
    result.resignedPiiCleared++;
  }

  await logAudit({
    action: "retention.run",
    user: { loginId: "cron" },
    after: result,
  });

  return result;
}
