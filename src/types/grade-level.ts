export type GradeLevel = "junior_high" | "high_school";

export const DEFAULT_GRADE_LEVEL: GradeLevel = "junior_high";

export function isGradeLevel(value: unknown): value is GradeLevel {
  return value === "junior_high" || value === "high_school";
}
