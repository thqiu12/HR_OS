import { db } from "./db";

/**
 * Generate the canonical set of reminders from current DB state.
 *
 * Produces reminders for:
 *   - 在留カード期限       — employees with zairyu_expiry within 90 days (severity tiered)
 *   - 試用期間終了         — employees in 試用期間 with probation_end within 30 days
 *   - 雇用契約終了         — employees with contract_end within 90 days
 *   - 書類未提出           — required onboarding docs in 未提出 status
 *   - 書類差戻し           — onboarding docs in 差戻し status
 *
 * The function returns the *expected* set; persisting it (with dedup +
 * preservation of handled_at) is done by `regenerateReminders` below.
 */

export type GeneratedReminder = {
  dedupKey: string;
  category: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  triggerDate: string;             // YYYY-MM-DD
  schoolId: string;
  targetType: "employee" | "onboarding_case" | "onboarding_document";
  targetId: string;
};

const ONE_DAY_MS = 86400 * 1000;
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const daysUntil = (iso: string, now: Date) => Math.floor((new Date(iso).getTime() - now.getTime()) / ONE_DAY_MS);

export function computeExpectedReminders(now: Date = new Date()): GeneratedReminder[] {
  const out: GeneratedReminder[] = [];
  const today = dateOnly(now);

  const employees: any[] = db.employees();
  const cases: any[] = db.onboardingCases();

  // ===== 在留カード期限 =====
  for (const e of employees) {
    if (!e.zairyuExpiry || e.status === "退職") continue;
    const days = daysUntil(e.zairyuExpiry, now);
    if (days > 90) continue;
    let severity: GeneratedReminder["severity"];
    let bucket: string;
    if (days <= 0) { severity = "critical"; bucket = "期限切れ"; }
    else if (days <= 30) { severity = "critical"; bucket = "30日以内"; }
    else if (days <= 60) { severity = "warn"; bucket = "60日以内"; }
    else { severity = "info"; bucket = "90日以内"; }

    out.push({
      dedupKey: `zairyu:${e.id}`,
      category: "在留カード期限",
      severity,
      title: `${e.name} さんの在留カードが${bucket}に期限切れ`,
      detail: `有効期限：${e.zairyuExpiry}（残り ${days}日）／ 在留資格更新の手続きをお願いします`,
      triggerDate: today,
      schoolId: e.schoolId,
      targetType: "employee",
      targetId: e.id,
    });
  }

  // ===== 試用期間終了 =====
  for (const e of employees) {
    if (e.status !== "試用期間" || !e.probationEnd) continue;
    const days = daysUntil(e.probationEnd, now);
    if (days < -7 || days > 30) continue;   // 1週間過ぎ〜30日先まで
    let severity: GeneratedReminder["severity"];
    if (days <= 0) severity = "critical";
    else if (days <= 14) severity = "warn";
    else severity = "info";

    out.push({
      dedupKey: `probation:${e.id}`,
      category: "試用期間終了",
      severity,
      title: `${e.name} さんの試用期間が${days <= 0 ? "終了済み" : days + "日後に終了"}`,
      detail: `試用期間終了日：${e.probationEnd}／ 評価面談の設定をお願いします`,
      triggerDate: today,
      schoolId: e.schoolId,
      targetType: "employee",
      targetId: e.id,
    });
  }

  // ===== 雇用契約終了 =====
  for (const e of employees) {
    if (!e.contractEnd) continue;
    const days = daysUntil(e.contractEnd, now);
    if (days < 0 || days > 90) continue;
    let severity: GeneratedReminder["severity"];
    if (days <= 30) severity = "critical";
    else if (days <= 60) severity = "warn";
    else severity = "info";

    out.push({
      dedupKey: `contract:${e.id}`,
      category: "雇用契約終了",
      severity,
      title: `${e.name} さんの雇用契約が ${days}日以内に終了`,
      detail: `契約終了日：${e.contractEnd}／ 契約更新の判断をお願いします`,
      triggerDate: today,
      schoolId: e.schoolId,
      targetType: "employee",
      targetId: e.id,
    });
  }

  // ===== 書類未提出 / 差戻し / 源泉徴収票 =====
  for (const c of cases) {
    if (c.status === "完了") continue;
    const expectedDays = c.expectedJoinDate ? daysUntil(c.expectedJoinDate, now) : 999;
    const severity: GeneratedReminder["severity"] =
      expectedDays <= 7 ? "critical" : expectedDays <= 30 ? "warn" : "info";

    for (const d of (c.docs || []) as any[]) {
      if (d.status === "未提出" && d.required) {
        const isGensen = d.code === "gensen_choshu";
        out.push({
          dedupKey: `doc_missing:${c.id}:${d.code}`,
          category: isGensen ? "源泉徴収票未提出" : "書類未提出",
          severity,
          title: `${c.candidateName} さんの「${d.name}」が未提出`,
          detail: `入社予定日：${c.expectedJoinDate}（残り ${expectedDays}日）`,
          triggerDate: today,
          schoolId: c.schoolId,
          targetType: "onboarding_document",
          targetId: `${c.id}:${d.code}`,
        });
      }
      if (d.status === "差戻し") {
        out.push({
          dedupKey: `doc_reject:${c.id}:${d.code}`,
          category: "書類差戻し",
          severity: "critical",
          title: `${c.candidateName} さんの「${d.name}」が差戻し中`,
          detail: `理由：${d.rejectReason || "（未記載）"} ／ 再提出が必要です`,
          triggerDate: today,
          schoolId: c.schoolId,
          targetType: "onboarding_document",
          targetId: `${c.id}:${d.code}`,
        });
      }
    }
  }

  return out;
}

export type RegenerateResult = {
  generated: number;
  removed: number;
  updated: number;
  durationMs: number;
};

/**
 * Persist the expected set: upsert by dedup_key, preserve handled_at across
 * runs, and remove auto-generated reminders that are no longer relevant.
 */
export function persistGeneratedReminders(
  expected: GeneratedReminder[],
  ranBy: string
): RegenerateResult {
  const start = Date.now();
  const conn = (db as any);  // we only call public accessors below
  const expectedKeys = new Set(expected.map((r) => r.dedupKey));

  // Read existing auto-generated reminders so we can preserve handled_at
  const existing: any[] = db.reminders().filter((r: any) => r.autoGenerated === 1);
  const handledByKey = new Map<string, { handledAt: string; handledBy: string | null }>();
  for (const r of existing) {
    if (r.handledAt) handledByKey.set(r.dedupKey, { handledAt: r.handledAt, handledBy: r.handledBy });
  }

  const before = existing.length;
  const tx = db.regenerateReminderTx;
  const result = tx({
    deleteAll: true,
    expected,
    handledByKey: Array.from(handledByKey.entries()),
    ranBy,
  });

  const removed = Math.max(0, before - expected.length + (result.preserved || 0));
  const generated = expected.length;
  const durationMs = Date.now() - start;

  db.recordReminderGeneratorRun({
    ranBy,
    generatedCount: generated,
    removedCount: removed,
    durationMs,
  });

  return { generated, removed, updated: result.preserved || 0, durationMs };
}

export function regenerateReminders(ranBy: string): RegenerateResult {
  const expected = computeExpectedReminders(new Date());
  return persistGeneratedReminders(expected, ranBy);
}
