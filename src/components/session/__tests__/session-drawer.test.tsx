/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionDrawer } from "@/components/session/session-drawer";
import type { Session } from "@/types/session";

// @base-ui/react/dialog のモック
// 実際のモジュールは { Dialog } という named export を持つ
// Dialog.Root は open が true の場合のみ children をレンダリングする
jest.mock("@base-ui/react/dialog", () => {
  const React = require("react");
  return {
    Dialog: {
      Root: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange?: (open: boolean) => void }) => {
        if (!open) return null;
        return React.createElement("div", { "data-testid": "dialog-root", "data-open": open }, children);
      },
      Portal: ({ children }: { children: React.ReactNode }) =>
        React.createElement("div", { "data-testid": "dialog-portal" }, children),
      Backdrop: ({ className, onClick }: { className?: string; onClick?: () => void }) =>
        React.createElement("div", { "data-testid": "dialog-backdrop", className, onClick }),
      Popup: ({ children, className }: { children: React.ReactNode; className?: string }) =>
        React.createElement("div", { "data-testid": "dialog-popup", className }, children),
    },
  };
});

const makeSession = (
  id: string,
  messages: { role: "user" | "assistant"; content: string }[],
  createdAt = Date.now()
): Session => ({
  id,
  createdAt,
  messages,
});

describe("SessionDrawer", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    sessions: [],
    onSelectSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("表示制御（要件3.1）", () => {
    it("isOpen が false の場合、ドロワーは表示されない", () => {
      render(<SessionDrawer {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId("dialog-root")).toBeNull();
    });

    it("isOpen が true の場合、ドロワーが表示される（要件3.1）", () => {
      render(<SessionDrawer {...defaultProps} isOpen={true} />);
      expect(screen.getByTestId("dialog-root")).toBeTruthy();
    });
  });

  describe("空状態（要件3.2, 3.4）", () => {
    it("sessions が空配列の場合「まだ保存済みの会話がありません」を表示する", () => {
      render(<SessionDrawer {...defaultProps} sessions={[]} />);
      expect(screen.getByText("まだ保存済みの会話がありません")).toBeTruthy();
    });
  });

  describe("セッション一覧表示（要件3.2, 3.3）", () => {
    it("sessions がある場合、各セッションのプレビューを表示する（要件3.2, 3.3）", () => {
      const sessions = [
        makeSession("s1", [{ role: "user", content: "最初のセッションのメッセージ" }]),
        makeSession("s2", [{ role: "user", content: "2番目のセッションのメッセージ" }]),
      ];
      render(<SessionDrawer {...defaultProps} sessions={sessions} />);
      expect(screen.getByText("最初のセッションのメッセージ")).toBeTruthy();
      expect(screen.getByText("2番目のセッションのメッセージ")).toBeTruthy();
    });

    it("sessions がある場合、空状態メッセージは表示されない", () => {
      const sessions = [
        makeSession("s1", [{ role: "user", content: "テスト" }]),
      ];
      render(<SessionDrawer {...defaultProps} sessions={sessions} />);
      expect(screen.queryByText("まだ保存済みの会話がありません")).toBeNull();
    });

    it("30文字超過のプレビューは '...' で切り詰められる（要件3.3）", () => {
      const longMessage = "あ".repeat(31);
      const sessions = [makeSession("s1", [{ role: "user", content: longMessage }])];
      render(<SessionDrawer {...defaultProps} sessions={sessions} />);
      expect(screen.getByText("あ".repeat(30) + "...")).toBeTruthy();
    });
  });

  describe("セッション選択（要件4.1）", () => {
    it("セッション行をクリックすると onSelectSession が対応するセッションで呼ばれる（要件4.1）", () => {
      const onSelectSession = jest.fn();
      const session = makeSession("s1", [{ role: "user", content: "選択テスト" }]);
      render(
        <SessionDrawer
          {...defaultProps}
          sessions={[session]}
          onSelectSession={onSelectSession}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: "選択テスト" }));
      expect(onSelectSession).toHaveBeenCalledTimes(1);
      expect(onSelectSession).toHaveBeenCalledWith(session);
    });
  });

  describe("Dialog.Popup のスタイル", () => {
    it("Dialog.Popup に正しいクラスが適用されている", () => {
      render(<SessionDrawer {...defaultProps} />);
      const popup = screen.getByTestId("dialog-popup");
      expect(popup.className).toContain("fixed");
      expect(popup.className).toContain("left-0");
      expect(popup.className).toContain("top-0");
      expect(popup.className).toContain("h-full");
      expect(popup.className).toContain("w-64");
      expect(popup.className).toContain("bg-white");
      expect(popup.className).toContain("shadow-xl");
    });
  });
});
