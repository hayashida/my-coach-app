/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "@/components/chat/chat-input";

jest.mock("@/lib/image-compression", () => ({
  compressImage: jest
    .fn()
    .mockResolvedValue({ data: "base64data", mimeType: "image/jpeg" }),
}));

describe("ChatInput", () => {
  const mockOnImageSubmit = jest.fn();

  beforeEach(() => {
    mockOnImageSubmit.mockClear();
  });

  // ─── 既存テスト（onImageSubmit prop を追加して互換性維持）──────────────

  it("Enter キーで onSubmit が呼ばれる（要件 1.3）", async () => {
    const onSubmit = jest.fn();
    render(
      <ChatInput
        onSubmit={onSubmit}
        onImageSubmit={mockOnImageSubmit}
        disabled={false}
      />
    );
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "テスト");
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("テスト");
  });

  it("Shift+Enter では onSubmit が呼ばれない（要件 1.4）", async () => {
    const onSubmit = jest.fn();
    render(
      <ChatInput
        onSubmit={onSubmit}
        onImageSubmit={mockOnImageSubmit}
        disabled={false}
      />
    );
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "テスト");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // ─── 新規テスト ────────────────────────────────────────────────────────

  it("写真ボタンが表示される（要件 1.1）", () => {
    render(
      <ChatInput
        onSubmit={jest.fn()}
        onImageSubmit={mockOnImageSubmit}
        disabled={false}
      />
    );
    expect(screen.getByRole("button", { name: /写真/i })).toBeTruthy();
  });

  it("写真ボタンをクリックするとファイルピッカーがトリガーされる（要件 1.1）", async () => {
    const clickSpy = jest
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    render(
      <ChatInput
        onSubmit={jest.fn()}
        onImageSubmit={mockOnImageSubmit}
        disabled={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /写真/i }));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("画像ファイル選択後にプレビュー状態へ遷移する（要件 1.2）", async () => {
    render(
      <ChatInput
        onSubmit={jest.fn()}
        onImageSubmit={mockOnImageSubmit}
        disabled={false}
      />
    );
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);
    await waitFor(() => {
      expect(screen.getByRole("img", { name: "プレビュー" })).toBeTruthy();
      expect(screen.getByRole("button", { name: /キャンセル/i })).toBeTruthy();
    });
  });

  it("プレビューでキャンセルすると通常入力に戻る（要件 1.4）", async () => {
    render(
      <ChatInput
        onSubmit={jest.fn()}
        onImageSubmit={mockOnImageSubmit}
        disabled={false}
      />
    );
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /キャンセル/i })).toBeTruthy();
    });
    await userEvent.click(screen.getByRole("button", { name: /キャンセル/i }));
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.queryByRole("img", { name: "プレビュー" })).toBeNull();
  });

  it("プレビューで送信ボタンをクリックすると onImageSubmit が呼ばれる（要件 1.3）", async () => {
    render(
      <ChatInput
        onSubmit={jest.fn()}
        onImageSubmit={mockOnImageSubmit}
        disabled={false}
      />
    );
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);
    await waitFor(() => {
      expect(screen.getByRole("img", { name: "プレビュー" })).toBeTruthy();
    });
    await userEvent.click(screen.getByRole("button", { name: /送信/i }));
    expect(mockOnImageSubmit).toHaveBeenCalledWith({
      data: "base64data",
      mimeType: "image/jpeg",
    });
  });

  it("disabled=true のとき写真ボタンが無効化される（要件 1.5）", () => {
    render(
      <ChatInput
        onSubmit={jest.fn()}
        onImageSubmit={mockOnImageSubmit}
        disabled={true}
      />
    );
    const photoButton = screen.getByRole("button", { name: /写真/i });
    expect((photoButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("非画像ファイル選択時にエラーメッセージが表示される（要件 1.6）", async () => {
    render(
      <ChatInput
        onSubmit={jest.fn()}
        onImageSubmit={mockOnImageSubmit}
        disabled={false}
      />
    );
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["test"], "test.txt", { type: "text/plain" });
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);
    await waitFor(() => {
      expect(
        screen.getByText(/画像ファイルを選択してください/i)
      ).toBeTruthy();
    });
    expect(screen.queryByRole("img", { name: "プレビュー" })).toBeNull();
  });
});
