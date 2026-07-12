/**
 * @jest-environment jsdom
 *
 * settings/page.tsx 統合テスト
 *
 * カバー要件:
 *   - 2.2: 画面表示時に現在保存されている学年レベルが選択済み表示される
 *   - 2.3: 選択を変更して保存すると保存済みの学年レベルが更新される
 *   - 2.4: 画面表示時に現在保存されている応答レベルが、学年レベルと同一画面上に選択済み表示される
 *   - 2.5: 応答レベルを変更して保存すると保存済みの応答レベルが更新される
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRouter } from "next/navigation";
import SettingsPage from "@/app/settings/page";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

const GRADE_LEVEL_KEY = "coach_grade_level";
const RESPONSE_LEVEL_KEY = "coach_response_level";

const pushMock = jest.fn();

beforeEach(() => {
  localStorage.clear();
  pushMock.mockClear();
  (useRouter as jest.Mock).mockReturnValue({ push: pushMock });
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

  it("保存すると、チャット画面へ自動的に遷移する", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(pushMock).toHaveBeenCalledWith("/chat");
  });

  it("チャット画面へ戻る導線が存在する", () => {
    render(<SettingsPage />);

    const backLink = screen.getByRole("link", { name: "チャットに戻る" });
    expect(backLink.getAttribute("href")).toBe("/chat");
  });

  it("見出しが「学年レベル・応答レベル設定」になっている", () => {
    render(<SettingsPage />);

    expect(
      screen.getByRole("heading", { name: "学年レベル・応答レベル設定" })
    ).not.toBeNull();
  });

  it("応答レベル未設定時、デフォルト（基本）が選択済み表示される（要件2.4）", () => {
    render(<SettingsPage />);

    const basicRadio = screen.getByRole("radio", { name: "基本" });
    const advancedRadio = screen.getByRole("radio", { name: "応用" });

    expect((basicRadio as HTMLInputElement).checked).toBe(true);
    expect((advancedRadio as HTMLInputElement).checked).toBe(false);
  });

  it("保存済みの応答レベル（応用）が、学年レベルと同一画面上に選択済み表示される（要件2.4）", () => {
    localStorage.setItem(RESPONSE_LEVEL_KEY, "advanced");

    render(<SettingsPage />);

    // 同一画面上に学年レベルの選択操作も存在する
    expect(screen.getByRole("radio", { name: "中学生" })).not.toBeNull();
    expect(screen.getByRole("radio", { name: "高校生" })).not.toBeNull();

    const advancedRadio = screen.getByRole("radio", { name: "応用" });
    expect((advancedRadio as HTMLInputElement).checked).toBe(true);
  });

  it("応答レベルの選択を変更しただけでは保存されない（保存ボタン押下前）", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("radio", { name: "応用" }));

    expect(localStorage.getItem(RESPONSE_LEVEL_KEY)).toBeNull();
  });

  it("応答レベルの選択を変更して保存すると、保存済みの応答レベルが更新され画面に反映される（要件2.5）", () => {
    render(<SettingsPage />);

    // デフォルトは基本が選択されている
    expect(
      (screen.getByRole("radio", { name: "基本" }) as HTMLInputElement).checked
    ).toBe(true);

    // 応用を選択
    fireEvent.click(screen.getByRole("radio", { name: "応用" }));

    // 保存ボタンを押す
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    // localStorage に反映されている
    expect(localStorage.getItem(RESPONSE_LEVEL_KEY)).toBe("advanced");

    // 画面上の「現在の応答レベル」表示が更新される
    expect(screen.getByTestId("current-response-level").textContent).toBe(
      "応用"
    );

    // 選択状態も保存された値のまま
    expect(
      (screen.getByRole("radio", { name: "応用" }) as HTMLInputElement).checked
    ).toBe(true);
  });

  it("学年レベル・応答レベルの両方を変更して保存すると、両方とも独立して更新される", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("radio", { name: "高校生" }));
    fireEvent.click(screen.getByRole("radio", { name: "応用" }));

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(localStorage.getItem(GRADE_LEVEL_KEY)).toBe("high_school");
    expect(localStorage.getItem(RESPONSE_LEVEL_KEY)).toBe("advanced");
    expect(screen.getByTestId("current-grade-level").textContent).toBe(
      "高校生"
    );
    expect(screen.getByTestId("current-response-level").textContent).toBe(
      "応用"
    );
  });
});
