/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionListItem } from "@/components/session/session-list-item";
import type { Session } from "@/types/session";

const makeSession = (messages: { role: "user" | "assistant"; content: string }[]): Session => ({
  id: "test-id",
  createdAt: Date.now(),
  messages,
});

describe("SessionListItem", () => {
  it("最初のユーザーメッセージが30文字以内の場合、そのまま表示する（要件3.3）", () => {
    const session = makeSession([
      { role: "user", content: "こんにちは" },
      { role: "assistant", content: "はい、どうぞ" },
    ]);
    render(<SessionListItem session={session} onSelect={jest.fn()} />);
    expect(screen.getByText("こんにちは")).toBeTruthy();
  });

  it("最初のユーザーメッセージが30文字超過の場合、30文字 + '...' を表示する（要件3.3）", () => {
    const longMessage = "あ".repeat(31);
    const session = makeSession([
      { role: "user", content: longMessage },
    ]);
    render(<SessionListItem session={session} onSelect={jest.fn()} />);
    expect(screen.getByText("あ".repeat(30) + "...")).toBeTruthy();
  });

  it("最初のユーザーメッセージがちょうど30文字の場合、そのまま表示する（境界値）", () => {
    const exactMessage = "い".repeat(30);
    const session = makeSession([
      { role: "user", content: exactMessage },
    ]);
    render(<SessionListItem session={session} onSelect={jest.fn()} />);
    expect(screen.getByText(exactMessage)).toBeTruthy();
  });

  it("最初のメッセージが assistant の場合、次のユーザーメッセージを表示する", () => {
    const session = makeSession([
      { role: "assistant", content: "AIからのメッセージ" },
      { role: "user", content: "ユーザーのメッセージ" },
    ]);
    render(<SessionListItem session={session} onSelect={jest.fn()} />);
    expect(screen.getByText("ユーザーのメッセージ")).toBeTruthy();
  });

  it("ユーザーメッセージが存在しない場合、'（メッセージなし）' を表示する（要件3.3）", () => {
    const session = makeSession([
      { role: "assistant", content: "AIのみのメッセージ" },
    ]);
    render(<SessionListItem session={session} onSelect={jest.fn()} />);
    expect(screen.getByText("（メッセージなし）")).toBeTruthy();
  });

  it("messagesが空の場合、'（メッセージなし）' を表示する", () => {
    const session = makeSession([]);
    render(<SessionListItem session={session} onSelect={jest.fn()} />);
    expect(screen.getByText("（メッセージなし）")).toBeTruthy();
  });

  it("クリック時に onSelect が呼ばれる", async () => {
    const onSelect = jest.fn();
    const session = makeSession([{ role: "user", content: "テスト" }]);
    render(<SessionListItem session={session} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
