import { DEFAULT_GRADE_LEVEL, isGradeLevel } from "@/types/grade-level";

describe("DEFAULT_GRADE_LEVEL", () => {
  it("既定値は中学生（junior_high）である", () => {
    expect(DEFAULT_GRADE_LEVEL).toBe("junior_high");
  });
});

describe("isGradeLevel", () => {
  it("中学生（junior_high）は有効な学年レベルとして true を返す", () => {
    expect(isGradeLevel("junior_high")).toBe(true);
  });

  it("高校生（high_school）は有効な学年レベルとして true を返す", () => {
    expect(isGradeLevel("high_school")).toBe(true);
  });

  it("不正な文字列は false を返す", () => {
    expect(isGradeLevel("university")).toBe(false);
  });

  it("空文字列は false を返す", () => {
    expect(isGradeLevel("")).toBe(false);
  });

  it("undefined は false を返す", () => {
    expect(isGradeLevel(undefined)).toBe(false);
  });

  it("null は false を返す", () => {
    expect(isGradeLevel(null)).toBe(false);
  });

  it("数値は false を返す", () => {
    expect(isGradeLevel(1)).toBe(false);
  });

  it("オブジェクトは false を返す", () => {
    expect(isGradeLevel({ value: "junior_high" })).toBe(false);
  });
});
