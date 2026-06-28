/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { ReadonlyBanner } from "@/components/session/readonly-banner";

describe("ReadonlyBanner", () => {
  it("「過去の会話を表示中」ラベルを表示する（要件4.3）", () => {
    render(<ReadonlyBanner onReturn={jest.fn()} />);
    expect(screen.getByText("過去の会話を表示中")).toBeTruthy();
  });

  it("「現在の会話に戻る」ボタンを表示する（要件4.3）", () => {
    render(<ReadonlyBanner onReturn={jest.fn()} />);
    expect(screen.getByRole("button", { name: "現在の会話に戻る" })).toBeTruthy();
  });

  it("「現在の会話に戻る」ボタンをクリックすると onReturn が呼ばれる（要件4.4）", () => {
    const onReturn = jest.fn();
    render(<ReadonlyBanner onReturn={onReturn} />);
    fireEvent.click(screen.getByRole("button", { name: "現在の会話に戻る" }));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("sticky top-0 クラスが適用されている", () => {
    const { container } = render(<ReadonlyBanner onReturn={jest.fn()} />);
    const banner = container.firstChild as HTMLElement;
    expect(banner.className).toContain("sticky");
    expect(banner.className).toContain("top-0");
  });
});
