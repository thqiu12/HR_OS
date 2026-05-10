import { describe, it, expect } from "vitest";
import {
  EMPLOYMENT_TYPES, EMPLOYMENT_LABEL, WAGE_MODEL,
  usesFullReview, hasFixedTermContract, appliesSocialInsurance,
  isValidEmploymentType,
} from "../lib/employment-types";
import { templateFor } from "../lib/review-templates";

describe("employment-types metadata", () => {
  it("has all 4 standard types", () => {
    expect(EMPLOYMENT_TYPES).toEqual(["regular", "contract", "part_time", "gyomu_itaku"]);
    for (const t of EMPLOYMENT_TYPES) {
      expect(EMPLOYMENT_LABEL[t]).toBeTruthy();
    }
  });

  it("wage model: regular/contract = monthly, part_time = hourly, gyomu_itaku = per_class", () => {
    expect(WAGE_MODEL.regular).toBe("monthly");
    expect(WAGE_MODEL.contract).toBe("monthly");
    expect(WAGE_MODEL.part_time).toBe("hourly");
    expect(WAGE_MODEL.gyomu_itaku).toBe("per_class");
  });

  it("only regular employees use the full 8-stage review", () => {
    expect(usesFullReview("regular")).toBe(true);
    expect(usesFullReview("contract")).toBe(false);
    expect(usesFullReview("part_time")).toBe(false);
    expect(usesFullReview("gyomu_itaku")).toBe(false);
  });

  it("non-regular employees have fixed-term contracts requiring renewal mgmt", () => {
    expect(hasFixedTermContract("regular")).toBe(false);
    expect(hasFixedTermContract("contract")).toBe(true);
    expect(hasFixedTermContract("part_time")).toBe(true);
    expect(hasFixedTermContract("gyomu_itaku")).toBe(true);
  });

  it("社保適用: regular + contract のみ", () => {
    expect(appliesSocialInsurance("regular")).toBe(true);
    expect(appliesSocialInsurance("contract")).toBe(true);
    expect(appliesSocialInsurance("part_time")).toBe(false);
    expect(appliesSocialInsurance("gyomu_itaku")).toBe(false);
  });

  it("validates input strings", () => {
    expect(isValidEmploymentType("regular")).toBe(true);
    expect(isValidEmploymentType("partTime")).toBe(false);
    expect(isValidEmploymentType("")).toBe(false);
    expect(isValidEmploymentType(null)).toBe(false);
    expect(isValidEmploymentType(123)).toBe(false);
  });
});

describe("review template branching by employment_type", () => {
  it("part_time gets the simplified 3-item template (not full 7-item)", () => {
    const items = templateFor("annual", "part_time");
    expect(items.length).toBe(3);
    expect(items.map((i) => i.itemKey)).toContain("pt_class_quality");
    expect(items.map((i) => i.itemKey)).toContain("pt_punctuality");
    expect(items.map((i) => i.itemKey)).toContain("pt_collaboration");
  });

  it("gyomu_itaku also gets the simplified template", () => {
    const items = templateFor("annual", "gyomu_itaku");
    expect(items.length).toBe(3);
  });

  it("regular employees get the full template (4 competency + 3 behavior = 7 items)", () => {
    const items = templateFor("annual", "regular");
    expect(items.length).toBe(7);
    expect(items.filter((i) => i.category === "competency").length).toBe(4);
    expect(items.filter((i) => i.category === "behavior").length).toBe(3);
  });

  it("contract employees get the full template (treated as monthly staff)", () => {
    const items = templateFor("annual", "contract");
    expect(items.length).toBe(7);
  });

  it("no employment_type defaults to full template (backward compat)", () => {
    const items = templateFor("annual");
    expect(items.length).toBe(7);
  });

  it("probation review for regular: full probation template + competency + behavior", () => {
    const items = templateFor("probation", "regular");
    // 3 probation perf + 4 competency + 3 behavior
    expect(items.length).toBe(10);
  });

  it("probation review for part_time still uses simplified 3-item template", () => {
    const items = templateFor("probation", "part_time");
    expect(items.length).toBe(3);
  });
});
