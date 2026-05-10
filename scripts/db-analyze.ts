/**
 * Print EXPLAIN QUERY PLAN for hot queries to spot missing indexes / table scans.
 * Run: tsx scripts/db-analyze.ts
 */

import Database from "better-sqlite3";
import path from "path";
import { analyzeQueries } from "../lib/db-perf";

const dbPath = process.env.HR_DB_PATH || path.join(process.cwd(), "hr-os.db");
const conn = new Database(dbPath, { readonly: true });

console.log(`\n=== Query plan analysis: ${dbPath} ===\n`);
const results = analyzeQueries(conn);

let scanCount = 0;
for (const r of results) {
  console.log(`▶ ${r.name}`);
  for (const line of r.plan) {
    const isScan = line.includes("SCAN") && !line.includes("USING INDEX");
    if (isScan) scanCount++;
    console.log(`    ${isScan ? "⚠️ " : "  "}${line}`);
  }
  console.log("");
}

console.log(`\n=== Summary: ${scanCount} table scans without index ===`);
console.log("(Scans are OK on small tables; problematic when N > 1000)");

// Print all indexes
console.log("\n=== Existing indexes ===");
const indexes = conn.prepare(`
  SELECT name, tbl_name, sql FROM sqlite_master
  WHERE type='index' AND name NOT LIKE 'sqlite_%'
  ORDER BY tbl_name, name
`).all() as any[];
for (const i of indexes) {
  console.log(`  ${i.tbl_name}.${i.name}: ${i.sql || "(auto)"}`);
}

// Table size estimates
console.log("\n=== Table row counts ===");
const tables = conn.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as any[];
for (const t of tables) {
  if (t.name.startsWith("sqlite_")) continue;
  try {
    const n: any = conn.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get();
    console.log(`  ${t.name}: ${n.n}`);
  } catch {}
}
