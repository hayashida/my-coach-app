import { buildSystemPrompt } from "../system-prompt";

describe("buildSystemPrompt", () => {
  describe("common coaching policy (Req 3.4)", () => {
    it.each([["junior_high"], ["high_school"]] as const)(
      "%s の指示文には答えを直接教えないヒント中心の方針が含まれる",
      (gradeLevel) => {
        const prompt = buildSystemPrompt(gradeLevel);

        expect(prompt).toContain("問題の答えを直接教えてはいけません");
        expect(prompt).toContain("ヒントや問いかけ");
        expect(prompt).toContain("写真");
      },
    );
  });

  describe("junior_high (Req 3.1)", () => {
    it("中学校で学習する語彙・既習範囲を前提とした指示を含む", () => {
      const prompt = buildSystemPrompt("junior_high");

      expect(prompt).toContain("中学校で学習する語彙・既習範囲");
      expect(prompt).not.toContain("高校で学習する語彙・既習範囲");
    });
  });

  describe("high_school (Req 3.2)", () => {
    it("高校で学習する語彙・既習範囲を前提とした、中学生向けより高度な言葉づかいの指示を含む", () => {
      const prompt = buildSystemPrompt("high_school");

      expect(prompt).toContain("高校で学習する語彙・既習範囲");
      expect(prompt).toContain("中学生向けよりも高度な言葉づかい");
      expect(prompt).not.toContain("中学校で学習する語彙・既習範囲");
    });
  });
});
