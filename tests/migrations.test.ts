import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, appliedMigrations } from "@/lib/migrations";
import os from "os";
import path from "path";
import fs from "fs";

describe("migrations runner", () => {
  it("runs all migrations in order and is idempotent on second invocation", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mig-test-"));
    const dbPath = path.join(tmp, "test.db");
    const c = new Database(dbPath);

    const first = runMigrations(c);
    expect(first.length).toBeGreaterThanOrEqual(4);
    expect(first[0]).toBe("001_init");

    const allApplied = appliedMigrations(c);
    expect(allApplied).toContain("001_init");
    expect(allApplied).toContain("002_pii");
    expect(allApplied).toContain("003_audit_chain");
    expect(allApplied).toContain("004_rate_limit");

    // Second run is a no-op
    const second = runMigrations(c);
    expect(second.length).toBe(0);

    // Schema should be functional
    const cols: any[] = c.prepare("PRAGMA table_info(employees)").all();
    expect(cols.some((x) => x.name === "my_number_enc")).toBe(true);

    c.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
