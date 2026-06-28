/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "@/components/chat/chat-input";

describe("ChatInput", () => {
  it("Enter キーで onSubmit が呼ばれる（要件 1.3）", async () => {
    const onSubmit = jest.fn();
    render(<ChatInput onSubmit={onSubmit} disabled={false} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "テスト");
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("テスト");
  });

  it("Shift+Enter では onSubmit が呼ばれない（要件 1.4）", async () => {
    const onSubmit = jest.fn();
    render(<ChatInput onSubmit={onSubmit} disabled={false} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "テスト");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
