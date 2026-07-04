/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { ChatMessage } from "@/components/chat/chat-message";
import type { Message } from "@/types/message";

// react-markdown は jsdom 環境では動作しないためモック
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => {} }));
jest.mock("remark-math", () => ({ __esModule: true, default: () => {} }));
jest.mock("rehype-katex", () => ({ __esModule: true, default: () => {} }));

describe("ChatMessage", () => {
  // テスト 1: message.image が存在するとき <img> タグが表示される（要件 2.1, 2.2）
  it("message.image が存在するとき data URI 形式の <img> が表示される", () => {
    const message: Message = {
      role: "user",
      content: "[写真]",
      image: { data: "abc123", mimeType: "image/jpeg" },
    };
    render(<ChatMessage message={message} />);

    const img = screen.getByRole("img", { name: /送信した写真/i });
    expect(img).toBeTruthy();
    expect((img as HTMLImageElement).src).toBe(
      "data:image/jpeg;base64,abc123"
    );
  });

  // テスト 2: message.image が undefined で content="[写真]" のとき、テキストバブルで [写真] が表示される（要件 5.1）
  it("message.image が undefined で content=[写真] のとき、テキストバブルに [写真] が表示され img タグはない", () => {
    const message: Message = {
      role: "user",
      content: "[写真]",
      image: undefined,
    };
    render(<ChatMessage message={message} />);

    expect(screen.getByText("[写真]")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  // テスト 3: 通常のテキストメッセージが正常に表示される（regression test）
  it("通常のユーザーテキストメッセージが表示される", () => {
    const message: Message = {
      role: "user",
      content: "こんにちは",
    };
    render(<ChatMessage message={message} />);

    expect(screen.getByText("こんにちは")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  // テスト 3b: アシスタントメッセージが表示される（regression test）
  it("アシスタントメッセージが Markdown としてレンダリングされる", () => {
    const message: Message = {
      role: "assistant",
      content: "お役に立てます",
    };
    render(<ChatMessage message={message} />);

    expect(screen.getByText("お役に立てます")).toBeTruthy();
  });
});
