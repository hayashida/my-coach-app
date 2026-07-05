/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useGradeLevel } from "../use-grade-level";
import { DEFAULT_GRADE_LEVEL } from "@/types/grade-level";

const GRADE_LEVEL_KEY = "coach_grade_level";

beforeEach(() => {
  localStorage.clear();
});

describe("useGradeLevel", () => {
  it("未設定時にデフォルトの学年レベル（中学生）を返す（要件1.2）", () => {
    const { result } = renderHook(() => useGradeLevel());
    expect(result.current.gradeLevel).toBe(DEFAULT_GRADE_LEVEL);
  });

  it("保存済みの正常値（高校生）を読み込める（要件1.3）", () => {
    localStorage.setItem(GRADE_LEVEL_KEY, "high_school");
    const { result } = renderHook(() => useGradeLevel());
    expect(result.current.gradeLevel).toBe("high_school");
  });

  it("保存済みの正常値（中学生）を読み込める（要件1.3）", () => {
    localStorage.setItem(GRADE_LEVEL_KEY, "junior_high");
    const { result } = renderHook(() => useGradeLevel());
    expect(result.current.gradeLevel).toBe("junior_high");
  });

  it("不正値保存時はデフォルトの学年レベルにフォールバックする（要件1.4）", () => {
    localStorage.setItem(GRADE_LEVEL_KEY, "university");
    const { result } = renderHook(() => useGradeLevel());
    expect(result.current.gradeLevel).toBe(DEFAULT_GRADE_LEVEL);
  });

  it("setGradeLevel を呼び出すと gradeLevel が選択値に即座に更新される（要件1.1, 2.3）", () => {
    const { result } = renderHook(() => useGradeLevel());

    act(() => {
      result.current.setGradeLevel("high_school");
    });

    expect(result.current.gradeLevel).toBe("high_school");
    expect(localStorage.getItem(GRADE_LEVEL_KEY)).toBe("high_school");
  });

  it("localStorage.setItem が例外をスローしても gradeLevel の状態更新自体は成功する（要件4.1）", () => {
    const setItemSpy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    const { result } = renderHook(() => useGradeLevel());

    expect(() => {
      act(() => {
        result.current.setGradeLevel("high_school");
      });
    }).not.toThrow();

    expect(result.current.gradeLevel).toBe("high_school");

    setItemSpy.mockRestore();
  });
});
