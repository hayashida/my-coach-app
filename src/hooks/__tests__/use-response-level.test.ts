/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useResponseLevel } from "../use-response-level";
import { DEFAULT_RESPONSE_LEVEL } from "@/types/response-level";

const RESPONSE_LEVEL_KEY = "coach_response_level";

beforeEach(() => {
  localStorage.clear();
});

describe("useResponseLevel", () => {
  it("未設定時にデフォルトの応答レベル（基本）を返す（要件5.2）", () => {
    const { result } = renderHook(() => useResponseLevel());
    expect(result.current.responseLevel).toBe(DEFAULT_RESPONSE_LEVEL);
  });

  it("保存済みの正常値（応用）を読み込める（要件5.3）", () => {
    localStorage.setItem(RESPONSE_LEVEL_KEY, "advanced");
    const { result } = renderHook(() => useResponseLevel());
    expect(result.current.responseLevel).toBe("advanced");
  });

  it("保存済みの正常値（基本）を読み込める（要件5.3）", () => {
    localStorage.setItem(RESPONSE_LEVEL_KEY, "basic");
    const { result } = renderHook(() => useResponseLevel());
    expect(result.current.responseLevel).toBe("basic");
  });

  it("不正値保存時はデフォルトの応答レベルにフォールバックする（要件5.4）", () => {
    localStorage.setItem(RESPONSE_LEVEL_KEY, "expert");
    const { result } = renderHook(() => useResponseLevel());
    expect(result.current.responseLevel).toBe(DEFAULT_RESPONSE_LEVEL);
  });

  it("setResponseLevel を呼び出すと responseLevel が選択値に即座に更新される（要件5.1, 2.4, 2.5）", () => {
    const { result } = renderHook(() => useResponseLevel());

    act(() => {
      result.current.setResponseLevel("advanced");
    });

    expect(result.current.responseLevel).toBe("advanced");
    expect(localStorage.getItem(RESPONSE_LEVEL_KEY)).toBe("advanced");
  });

  it("localStorage.setItem が例外をスローしても responseLevel の状態更新自体は成功する（要件4.2）", () => {
    const setItemSpy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    const { result } = renderHook(() => useResponseLevel());

    expect(() => {
      act(() => {
        result.current.setResponseLevel("advanced");
      });
    }).not.toThrow();

    expect(result.current.responseLevel).toBe("advanced");

    setItemSpy.mockRestore();
  });
});
