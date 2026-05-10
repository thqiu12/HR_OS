import { describe, it, expect, beforeEach } from "vitest";
import { parseResumeFromPdf, mockParsedResume } from "@/lib/anthropic";

describe("anthropic resume parser", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns no_api_key + a usable mock when key is missing", async () => {
    const r = await parseResumeFromPdf(Buffer.from("not a real pdf"));
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.reason).toBe("no_api_key");
      expect(r.mock).toBeTruthy();
      expect(r.mock?.full_name).toContain("モック");
    }
  });

  it("mockParsedResume always returns a complete shape", () => {
    const m = mockParsedResume();
    expect(m.full_name).toBeTruthy();
    expect(m.summary.length).toBeGreaterThan(10);
    expect(m.education.length).toBeGreaterThan(0);
    expect(m.career.length).toBeGreaterThan(0);
    expect(m.qualifications.length).toBeGreaterThan(0);
    expect(["N1","N2","N3","N4","N5",null]).toContain(m.jlpt_level);
  });
});
