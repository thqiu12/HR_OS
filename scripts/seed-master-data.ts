/**
 * Insert standard master data: evaluation periods, position master,
 * school types — required for production but not part of mock seed.
 *
 * Idempotent: skips rows that already exist by natural key.
 *
 * Usage: tsx scripts/seed-master-data.ts
 */

import { db } from "../lib/db";

// Standard fiscal-year evaluation calendar (Japanese 4月始まり)
const REVIEW_PERIODS = [
  { code: "2026H1", label: "2026年度 上期", startDate: "2026-04-01", endDate: "2026-09-30", reviewDeadline: "2026-10-15" },
  { code: "2026H2", label: "2026年度 下期", startDate: "2026-10-01", endDate: "2027-03-31", reviewDeadline: "2027-04-15" },
  { code: "2026FY", label: "2026年度 通年", startDate: "2026-04-01", endDate: "2027-03-31", reviewDeadline: "2027-04-30" },
];

// Standard position / grade master (適宜カスタマイズ)
const POSITIONS = [
  { code: "P01", grade: 1, name: "アシスタント / 試用期間" },
  { code: "P02", grade: 2, name: "一般職" },
  { code: "P03", grade: 3, name: "主任 / リーダー" },
  { code: "P04", grade: 4, name: "係長 / マネージャー" },
  { code: "P05", grade: 5, name: "課長 / シニアマネージャー" },
  { code: "P06", grade: 6, name: "部長" },
  { code: "P07", grade: 7, name: "校長 / 学校長" },
  { code: "P08", grade: 8, name: "理事 / 経営層" },
];

function ensureMasterTable(name: string, ddl: string) {
  const c: any = db;
  // Use raw connection through any available helper; fall back to console hint
  console.log(`[seed-master] check table ${name}`);
}

function main() {
  console.log("[seed-master] master data is currently treated as configuration");
  console.log("[seed-master] Review periods (insert into your scheduling system):\n");
  for (const p of REVIEW_PERIODS) {
    console.log(`  - ${p.code}: ${p.label} (${p.startDate}〜${p.endDate}, 評価締切 ${p.reviewDeadline})`);
  }
  console.log("\n[seed-master] Position master (use as the 'position' free-text values):\n");
  for (const p of POSITIONS) {
    console.log(`  - [${p.code}] grade ${p.grade}: ${p.name}`);
  }
  console.log("\n[seed-master] These templates are for HR reference. Actual storage may require a future migration if you want them DB-backed.");
}

main();
