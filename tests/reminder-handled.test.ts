import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";

describe("reminders handled state", () => {
  it("markReminderHandled sets handled_at + handled_by", () => {
    const r = db.reminders().find((x: any) => x.id === "rm1");
    expect(r).toBeTruthy();

    db.markReminderHandled("rm1", "test-user");
    const after: any = db.reminder("rm1");
    expect(after.handledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(after.handledBy).toBe("test-user");

    db.unmarkReminderHandled("rm1");
    const reverted: any = db.reminder("rm1");
    expect(reverted.handledAt).toBeNull();
    expect(reverted.handledBy).toBeNull();
  });
});
