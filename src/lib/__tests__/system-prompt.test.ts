import { buildSystemPrompt } from "../system-prompt";

describe("buildSystemPrompt", () => {
  describe("common coaching policy (Req 3.4, 6.5)", () => {
    it.each([
      ["junior_high", "basic"],
      ["junior_high", "advanced"],
      ["high_school", "basic"],
      ["high_school", "advanced"],
    ] as const)(
      "%s / %s の指示文には答えを直接教えないヒント中心の方針が含まれる",
      (gradeLevel, responseLevel) => {
        const prompt = buildSystemPrompt(gradeLevel, responseLevel);

        expect(prompt).toContain("問題の答えを直接教えてはいけません");
        expect(prompt).toContain("ヒントや問いかけ");
        expect(prompt).toContain("写真");
      },
    );
  });

  describe("junior_high (Req 3.1)", () => {
    it("中学校で学習する語彙・既習範囲を前提とした指示を含む", () => {
      const prompt = buildSystemPrompt("junior_high", "basic");

      expect(prompt).toContain("中学校で学習する語彙・既習範囲");
      expect(prompt).not.toContain("高校で学習する語彙・既習範囲");
    });
  });

  describe("high_school (Req 3.2)", () => {
    it("高校で学習する語彙・既習範囲を前提とした、中学生向けより高度な言葉づかいの指示を含む", () => {
      const prompt = buildSystemPrompt("high_school", "basic");

      expect(prompt).toContain("高校で学習する語彙・既習範囲");
      expect(prompt).toContain("中学生向けよりも高度な言葉づかい");
      expect(prompt).not.toContain("中学校で学習する語彙・既習範囲");
    });
  });

  describe("basic response level (Req 6.1)", () => {
    it("答えを直接教えない範囲で、結論に近いわかりやすい一段階のヒントを提示する指示を含む", () => {
      const prompt = buildSystemPrompt("junior_high", "basic");

      expect(prompt).toContain(
        "答えを直接教えない範囲で、結論に近いわかりやすい一段階のヒントを提示してください",
      );
      expect(prompt).not.toContain(
        "概念的な問いかけや別解の検討を促す発展的なヒント",
      );
    });
  });

  describe("advanced response level (Req 6.2)", () => {
    it("答えを直接教えない範囲で、概念的な問いかけや別解の検討を促す発展的なヒントを提示する指示を含む", () => {
      const prompt = buildSystemPrompt("junior_high", "advanced");

      expect(prompt).toContain(
        "答えを直接教えない範囲で、概念的な問いかけや別解の検討を促す発展的なヒントを提示してください",
      );
      expect(prompt).not.toContain(
        "結論に近いわかりやすい一段階のヒント",
      );
    });
  });

  describe("independence of gradeLevel and responseLevel axes (Req 6.4)", () => {
    it("responseLevel が basic/advanced のいずれでも、gradeLevel の語彙指示は変わらない", () => {
      const basicPrompt = buildSystemPrompt("high_school", "basic");
      const advancedPrompt = buildSystemPrompt("high_school", "advanced");

      for (const prompt of [basicPrompt, advancedPrompt]) {
        expect(prompt).toContain("高校で学習する語彙・既習範囲");
        expect(prompt).toContain("中学生向けよりも高度な言葉づかい");
        expect(prompt).not.toContain("中学校で学習する語彙・既習範囲");
      }
    });

    it("gradeLevel が junior_high/high_school のいずれでも、responseLevel のヒント発展度合い指示は変わらない", () => {
      const juniorPrompt = buildSystemPrompt("junior_high", "advanced");
      const highSchoolPrompt = buildSystemPrompt("high_school", "advanced");

      for (const prompt of [juniorPrompt, highSchoolPrompt]) {
        expect(prompt).toContain(
          "答えを直接教えない範囲で、概念的な問いかけや別解の検討を促す発展的なヒントを提示してください",
        );
      }
    });
  });
});
