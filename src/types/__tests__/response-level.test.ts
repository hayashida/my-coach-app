import { DEFAULT_RESPONSE_LEVEL, isResponseLevel } from "@/types/response-level";

describe("DEFAULT_RESPONSE_LEVEL", () => {
  it("既定値は基本（basic）である", () => {
    expect(DEFAULT_RESPONSE_LEVEL).toBe("basic");
  });
});

describe("isResponseLevel", () => {
  it("基本（basic）は有効な応答レベルとして true を返す", () => {
    expect(isResponseLevel("basic")).toBe(true);
  });

  it("応用（advanced）は有効な応答レベルとして true を返す", () => {
    expect(isResponseLevel("advanced")).toBe(true);
  });

  it("不正な文字列は false を返す", () => {
    expect(isResponseLevel("expert")).toBe(false);
  });

  it("空文字列は false を返す", () => {
    expect(isResponseLevel("")).toBe(false);
  });

  it("undefined は false を返す", () => {
    expect(isResponseLevel(undefined)).toBe(false);
  });

  it("null は false を返す", () => {
    expect(isResponseLevel(null)).toBe(false);
  });

  it("数値は false を返す", () => {
    expect(isResponseLevel(1)).toBe(false);
  });

  it("オブジェクトは false を返す", () => {
    expect(isResponseLevel({ value: "basic" })).toBe(false);
  });
});
