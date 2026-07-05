/**
 * @jest-environment jsdom
 *
 * settings/page.tsx 統合テスト
 *
 * カバー要件:
 *   - 2.2: 画面表示時に現在保存されている学年レベルが選択済み表示される
 *   - 2.3: 選択を変更して保存すると保存済みの学年レベルが更新される
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPage from "@/app/settings/page";

const GRADE_LEVEL_KEY = "coach_grade_level";

beforeEach(() => {
  localStorage.clear();
});

describe("SettingsPage 統合テスト", () => {
  it("学年レベル未設定時、デフォルト（中学生）が選択済み表示される（要件2.2）", () => {
    render(<SettingsPage />);

    const juniorRadio = screen.getByRole("radio", { name: "中学生" });
    const highSchoolRadio = screen.getByRole("radio", { name: "高校生" });

    expect((juniorRadio as HTMLInputElement).checked).toBe(true);
    expect((highSchoolRadio as HTMLInputElement).checked).toBe(false);
  });

  it("保存済みの学年レベル（高校生）が選択済み表示される（要件2.2）", () => {
    localStorage.setItem(GRADE_LEVEL_KEY, "high_school");

    render(<SettingsPage />);

    const highSchoolRadio = screen.getByRole("radio", { name: "高校生" });
    expect((highSchoolRadio as HTMLInputElement).checked).toBe(true);
  });

  it("選択を変更しただけでは保存されない（保存ボタン押下前）", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("radio", { name: "高校生" }));

    // 選択状態（ドラフト）は変わるが、永続化された値は変化しない
    expect(localStorage.getItem(GRADE_LEVEL_KEY)).toBeNull();
  });

  it("選択を変更して保存すると、保存済みの学年レベルが更新され画面に反映される（要件2.3）", () => {
    render(<SettingsPage />);

    // デフォルトは中学生が選択されている
    expect(
      (screen.getByRole("radio", { name: "中学生" }) as HTMLInputElement)
        .checked
    ).toBe(true);

    // 高校生を選択
    fireEvent.click(screen.getByRole("radio", { name: "高校生" }));

    // 保存ボタンを押す
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    // localStorage に反映されている
    expect(localStorage.getItem(GRADE_LEVEL_KEY)).toBe("high_school");

    // 画面上の「現在の学年レベル」表示が更新される
    expect(screen.getByTestId("current-grade-level").textContent).toBe(
      "高校生"
    );

    // 選択状態も保存された値のまま
    expect(
      (screen.getByRole("radio", { name: "高校生" }) as HTMLInputElement)
        .checked
    ).toBe(true);
  });

  it("チャット画面へ戻る導線が存在する", () => {
    render(<SettingsPage />);

    const backLink = screen.getByRole("link", { name: "チャットに戻る" });
    expect(backLink.getAttribute("href")).toBe("/chat");
  });
});
