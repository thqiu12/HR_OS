/**
 * Employment-type metadata. Drives display, filtering, and behavior branching
 * (e.g. which review template to use, what wage fields to show).
 *
 * Keep this list in sync with migrations/019_employment_type.sql.
 */

export type EmploymentType = "regular" | "contract" | "part_time" | "gyomu_itaku";

export const EMPLOYMENT_TYPES: EmploymentType[] = ["regular", "contract", "part_time", "gyomu_itaku"];

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  regular: "正社員",
  contract: "契約社員",
  part_time: "非常勤",
  gyomu_itaku: "業務委託",
};

export const EMPLOYMENT_TONE: Record<EmploymentType, string> = {
  regular: "indigo",
  contract: "blue",
  part_time: "amber",
  gyomu_itaku: "slate",
};

/** Wage display label per type — drives which monetary fields are relevant. */
export const WAGE_MODEL: Record<EmploymentType, "monthly" | "hourly" | "per_class"> = {
  regular: "monthly",
  contract: "monthly",
  part_time: "hourly",
  gyomu_itaku: "per_class",
};

/** Whether full 8-stage performance review applies. Lighter eval for non-regular. */
export function usesFullReview(t: EmploymentType): boolean {
  return t === "regular";
}

/** Whether contract-renewal reminders apply. */
export function hasFixedTermContract(t: EmploymentType): boolean {
  return t !== "regular";
}

/** Whether monthly social insurance / 給与計算 lines apply. */
export function appliesSocialInsurance(t: EmploymentType): boolean {
  // 業務委託 is NOT subject to 社保. part_time may or may not be (depends on hours);
  // we treat ≤ 2/3 of regular hours as exempt by default and flag UI for HR review.
  return t === "regular" || t === "contract";
}

export function isValidEmploymentType(s: any): s is EmploymentType {
  return typeof s === "string" && EMPLOYMENT_TYPES.includes(s as EmploymentType);
}
