import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import Database from "better-sqlite3";

describe("audit log hash chain", () => {
  it("verifies cleanly after a few inserts", async () => {
    await logAudit({ action: "test.chain.a" });
    await logAudit({ action: "test.chain.b" });
    await logAudit({ action: "test.chain.c" });
    const r = db.verifyAuditChain();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.count).toBeGreaterThanOrEqual(3);
      expect(r.headHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("triggers reject UPDATE on audit_logs", async () => {
    await logAudit({ action: "test.update.target" });
    const dbPath = process.env.HR_DB_PATH!;
    const direct = new Database(dbPath);
    expect(() =>
      direct.prepare("UPDATE audit_logs SET action = 'tampered' WHERE id = (SELECT MAX(id) FROM audit_logs)").run()
    ).toThrow(/append-only/);
    direct.close();
  });

  it("triggers reject DELETE on audit_logs", async () => {
    await logAudit({ action: "test.delete.target" });
    const dbPath = process.env.HR_DB_PATH!;
    const direct = new Database(dbPath);
    expect(() =>
      direct.prepare("DELETE FROM audit_logs WHERE id = (SELECT MAX(id) FROM audit_logs)").run()
    ).toThrow(/append-only/);
    direct.close();
  });

  it("detects tampering when triggers are bypassed (simulated by direct hash mutation)", async () => {
    // We can't UPDATE the row (trigger blocks). To simulate filesystem-level
    // tampering we open the DB and TEMPORARILY drop the trigger, mutate, then
    // reinstate it — verifying that the chain detects the change.
    await logAudit({ action: "test.tamper.before" });
    await logAudit({ action: "test.tamper.target" });
    await logAudit({ action: "test.tamper.after" });

    const dbPath = process.env.HR_DB_PATH!;
    const direct = new Database(dbPath);
    direct.exec("DROP TRIGGER audit_logs_no_update");
    direct.prepare(
      "UPDATE audit_logs SET action = 'TAMPERED' WHERE action = 'test.tamper.target'"
    ).run();
    direct.exec(`
      CREATE TRIGGER audit_logs_no_update
      BEFORE UPDATE ON audit_logs
      BEGIN
        SELECT RAISE(ABORT, 'audit_logs is append-only');
      END;
    `);
    direct.close();

    const r = db.verifyAuditChain();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(["row_hash mismatch", "prev_hash mismatch"]).toContain(r.reason);
    }
  });
});
