/**
 * @jest-environment jsdom
 *
 * chat/page.tsx 統合テスト
 *
 * カバー要件:
 *   - 2.4: ストリーミング中は「新しい会話」が disabled
 *   - 2.5: messages.length=0 のとき「新しい会話」が disabled
 *   - 4.1: ドロワーでセッション選択 → 読み取り専用モードに切り替わり選択セッションのメッセージを表示
 *   - 4.2: 読み取り専用モード中は ChatInput が非表示
 *   - 4.3: 読み取り専用モード中は ReadonlyBanner が表示
 *   - 3.3 (grade-level-coaching): 保存済みの学年レベルを取得し useChat に渡す。変更後は新しい学年レベルが使われる
 *   - 6.3 (grade-level-coaching): 保存済みの応答レベルを取得し useChat に渡す。変更後は新しい応答レベルが使われる
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useChat } from "@/hooks/use-chat";
import { useSessionStorage } from "@/hooks/use-session-storage";
import { useGradeLevel } from "@/hooks/use-grade-level";
import { useResponseLevel } from "@/hooks/use-response-level";
import ChatPage from "@/app/chat/page";
import type { Session } from "@/types/session";
import type { Message } from "@/types/message";
import type { GradeLevel } from "@/types/grade-level";
import type { ResponseLevel } from "@/types/response-level";

// ─── モック定義 ───────────────────────────────────────────

jest.mock("@/hooks/use-chat", () => ({
  useChat: jest.fn(),
}));

jest.mock("@/hooks/use-session-storage", () => ({
  useSessionStorage: jest.fn(),
}));

jest.mock("@/hooks/use-grade-level", () => ({
  useGradeLevel: jest.fn(),
}));

jest.mock("@/hooks/use-response-level", () => ({
  useResponseLevel: jest.fn(),
}));

jest.mock(
  "@/components/session/session-drawer",
  () => ({
    SessionDrawer: ({
      isOpen,
      sessions,
      onSelectSession,
      onNewChat,
      isNewChatDisabled,
    }: {
      isOpen: boolean;
      sessions: Session[];
      onSelectSession: (session: Session) => void;
      onClose: () => void;
      onNewChat: () => void;
      isNewChatDisabled: boolean;
    }) => (
      <>
        <button onClick={onNewChat} disabled={isNewChatDisabled}>
          新しい会話
        </button>
        {isOpen && (
          <div data-testid="drawer">
            {sessions.map((s) => (
              <button key={s.id} onClick={() => onSelectSession(s)}>
                {s.id}
              </button>
            ))}
          </div>
        )}
      </>
    ),
  })
);

jest.mock(
  "@/components/session/readonly-banner",
  () => ({
    ReadonlyBanner: ({ onReturn }: { onReturn: () => void }) => (
      <div data-testid="readonly-banner">
        <button onClick={onReturn}>現在の会話に戻る</button>
      </div>
    ),
  })
);

jest.mock(
  "@/components/chat/chat-message",
  () => ({
    ChatMessage: ({
      message,
    }: {
      message: Message;
    }) => (
      <div data-testid={`message-${message.role}`}>{message.content}</div>
    ),
  })
);

jest.mock(
  "@/components/chat/chat-input",
  () => ({
    ChatInput: ({
      onImageSubmit,
    }: {
      onImageSubmit?: (image: { data: string; mimeType: "image/jpeg" }) => void;
    }) => (
      <div data-testid="chat-input">
        {onImageSubmit && (
          <button
            data-testid="image-submit-btn"
            onClick={() =>
              onImageSubmit({ data: "test-base64", mimeType: "image/jpeg" })
            }
          >
            画像送信
          </button>
        )}
      </div>
    ),
  })
);

jest.mock(
  "@/components/auth/logout-button",
  () => ({
    LogoutButton: () => <button>ログアウト</button>,
  })
);

// ─── 型キャスト ────────────────────────────────────────────

const mockUseChat = useChat as jest.MockedFunction<typeof useChat>;
const mockUseSessionStorage =
  useSessionStorage as jest.MockedFunction<typeof useSessionStorage>;
const mockUseGradeLevel =
  useGradeLevel as jest.MockedFunction<typeof useGradeLevel>;
const mockUseResponseLevel =
  useResponseLevel as jest.MockedFunction<typeof useResponseLevel>;

// ─── ヘルパー ──────────────────────────────────────────────

function makeSession(
  id: string,
  messages: Message[],
  createdAt = Date.now()
): Session {
  return { id, createdAt, messages };
}

function setupMocks(options: {
  messages?: Message[];
  isStreaming?: boolean;
  pastSessions?: Session[];
  gradeLevel?: GradeLevel;
  responseLevel?: ResponseLevel;
}) {
  const clearMessages = jest.fn();
  const sendMessage = jest.fn().mockResolvedValue(undefined);

  const sendImage = jest.fn().mockResolvedValue(undefined);

  mockUseChat.mockReturnValue({
    messages: options.messages ?? [],
    isStreaming: options.isStreaming ?? false,
    error: null,
    sendMessage,
    sendImage,
    clearMessages,
  });

  mockUseSessionStorage.mockReturnValue({
    pastSessions: options.pastSessions ?? [],
    initialSessionData: null,
    saveCurrentSession: jest.fn(),
    archiveCurrentSession: jest.fn(),
  });

  const setGradeLevel = jest.fn();
  mockUseGradeLevel.mockReturnValue({
    gradeLevel: options.gradeLevel ?? "junior_high",
    setGradeLevel,
  });

  const setResponseLevel = jest.fn();
  mockUseResponseLevel.mockReturnValue({
    responseLevel: options.responseLevel ?? "basic",
    setResponseLevel,
  });

  return { clearMessages, sendMessage, sendImage, setGradeLevel, setResponseLevel };
}

// ─── テスト ────────────────────────────────────────────────

describe("ChatPage 統合テスト", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 要件 2.4: isStreaming=true のとき「新しい会話」が disabled ──

  describe("「新しい会話」ボタン - disabled 条件（要件2.4, 2.5）", () => {
    it("isStreaming=true のとき「新しい会話」ボタンが disabled になる（要件2.4）", () => {
      setupMocks({
        messages: [{ role: "user", content: "テスト" }],
        isStreaming: true,
      });

      render(<ChatPage />);

      const button = screen.getByRole("button", { name: "新しい会話" });
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });

    it("isStreaming=false かつ messages.length > 0 のとき「新しい会話」ボタンは enabled", () => {
      setupMocks({
        messages: [{ role: "user", content: "テスト" }],
        isStreaming: false,
      });

      render(<ChatPage />);

      const button = screen.getByRole("button", { name: "新しい会話" });
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });

    it("messages.length=0 のとき「新しい会話」ボタンが disabled になる（要件2.5）", () => {
      setupMocks({
        messages: [],
        isStreaming: false,
      });

      render(<ChatPage />);

      const button = screen.getByRole("button", { name: "新しい会話" });
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });

    it("isStreaming=true かつ messages.length=0 のときも「新しい会話」ボタンが disabled（要件2.4, 2.5）", () => {
      setupMocks({
        messages: [],
        isStreaming: true,
      });

      render(<ChatPage />);

      const button = screen.getByRole("button", { name: "新しい会話" });
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });

  // ── 要件 4.1: ドロワーでセッション選択 → 読み取り専用モード & メッセージ表示 ──

  describe("ドロワーでセッション選択 → 読み取り専用モード（要件4.1）", () => {
    it("セッション選択後、選択したセッションのメッセージが表示される（要件4.1）", async () => {
      const pastSession = makeSession("past-1", [
        { role: "user", content: "過去のメッセージ" },
        { role: "assistant", content: "過去のAI応答" },
      ]);

      setupMocks({
        messages: [{ role: "user", content: "現在のメッセージ" }],
        pastSessions: [pastSession],
      });

      render(<ChatPage />);

      // ドロワーを開く
      fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));

      // ドロワー内のセッションボタン（id が表示される）をクリック
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "past-1" }));
      });

      // 選択したセッションのメッセージが表示されている
      expect(screen.getByText("過去のメッセージ")).toBeTruthy();
      expect(screen.getByText("過去のAI応答")).toBeTruthy();

      // 現在のセッションのメッセージは表示されていない
      expect(screen.queryByText("現在のメッセージ")).toBeNull();
    });

    it("セッション選択後、ドロワーが閉じる（要件4.1）", async () => {
      const pastSession = makeSession("past-1", [
        { role: "user", content: "過去のメッセージ" },
      ]);

      setupMocks({ pastSessions: [pastSession] });

      render(<ChatPage />);

      // ドロワーを開く
      fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));
      expect(screen.getByTestId("drawer")).toBeTruthy();

      // セッション選択
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "past-1" }));
      });

      // ドロワーが閉じている
      expect(screen.queryByTestId("drawer")).toBeNull();
    });
  });

  // ── 要件 4.2: 読み取り専用モード中は ChatInput が非表示 ──
  // ── 要件 4.3: 読み取り専用モード中は ReadonlyBanner が表示 ──

  describe("読み取り専用モード（要件4.2, 4.3）", () => {
    it("通常モードでは ChatInput が表示され、ReadonlyBanner は非表示（初期状態）", () => {
      setupMocks({ messages: [] });

      render(<ChatPage />);

      expect(screen.getByTestId("chat-input")).toBeTruthy();
      expect(screen.queryByTestId("readonly-banner")).toBeNull();
    });

    it("読み取り専用モード中: ChatInput が非表示になる（要件4.2）", async () => {
      const pastSession = makeSession("past-1", [
        { role: "user", content: "過去メッセージ" },
      ]);

      setupMocks({ pastSessions: [pastSession] });

      render(<ChatPage />);

      // ドロワーを開いてセッション選択
      fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "past-1" }));
      });

      // ChatInput が非表示
      expect(screen.queryByTestId("chat-input")).toBeNull();
    });

    it("読み取り専用モード中: ReadonlyBanner が表示される（要件4.3）", async () => {
      const pastSession = makeSession("past-1", [
        { role: "user", content: "過去メッセージ" },
      ]);

      setupMocks({ pastSessions: [pastSession] });

      render(<ChatPage />);

      // ドロワーを開いてセッション選択
      fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "past-1" }));
      });

      // ReadonlyBanner が表示されている
      expect(screen.getByTestId("readonly-banner")).toBeTruthy();
    });

    it("「現在の会話に戻る」クリックで通常モードに戻り、ChatInput が再表示される（要件4.4）", async () => {
      const pastSession = makeSession("past-1", [
        { role: "user", content: "過去メッセージ" },
      ]);

      setupMocks({
        messages: [{ role: "user", content: "現在メッセージ" }],
        pastSessions: [pastSession],
      });

      render(<ChatPage />);

      // 読み取り専用モードに切り替え
      fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "past-1" }));
      });

      expect(screen.queryByTestId("chat-input")).toBeNull();
      expect(screen.getByTestId("readonly-banner")).toBeTruthy();

      // 「現在の会話に戻る」をクリック
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "現在の会話に戻る" }));
      });

      // 通常モードに戻る
      expect(screen.getByTestId("chat-input")).toBeTruthy();
      expect(screen.queryByTestId("readonly-banner")).toBeNull();

      // 現在のメッセージが表示されている
      expect(screen.getByText("現在メッセージ")).toBeTruthy();
    });
  });

  // ── onImageSubmit → useChat.sendImage 呼び出し ──

  describe("onImageSubmit → useChat.sendImage 呼び出し（画像送信フロー）", () => {
    it("onImageSubmit コールバックが useChat.sendImage を呼び出す", async () => {
      const { sendImage } = setupMocks({ messages: [] });

      render(<ChatPage />);

      // ChatInput モックに埋め込んだ画像送信トリガーをクリック
      await act(async () => {
        fireEvent.click(screen.getByTestId("image-submit-btn"));
      });

      expect(sendImage).toHaveBeenCalledWith({
        data: "test-base64",
        mimeType: "image/jpeg",
      });
    });
  });

  // ── 学年レベルの取得と useChat への反映（要件3.3） ──

  describe("学年レベルの取得と useChat への反映（要件3.3）", () => {
    it("useGradeLevel が返す学年レベル（high_school）が useChat に渡される", () => {
      setupMocks({ messages: [], gradeLevel: "high_school" });

      render(<ChatPage />);

      expect(mockUseChat).toHaveBeenCalledWith(
        expect.objectContaining({ gradeLevel: "high_school" })
      );
    });

    it("useGradeLevel が返す学年レベル（junior_high）が useChat に渡される", () => {
      setupMocks({ messages: [], gradeLevel: "junior_high" });

      render(<ChatPage />);

      expect(mockUseChat).toHaveBeenCalledWith(
        expect.objectContaining({ gradeLevel: "junior_high" })
      );
    });

    it("設定画面で学年レベルを変更後にチャット画面へ戻ると、変更後の学年レベルが useChat に渡される", () => {
      setupMocks({ messages: [], gradeLevel: "junior_high" });

      const { rerender } = render(<ChatPage />);

      expect(mockUseChat).toHaveBeenLastCalledWith(
        expect.objectContaining({ gradeLevel: "junior_high" })
      );

      // 設定画面で high_school に変更してチャット画面へ戻った状態を模擬
      // （ChatPage 再マウント時に useGradeLevel が新しい保存値を返す）
      setupMocks({ messages: [], gradeLevel: "high_school" });

      rerender(<ChatPage />);

      expect(mockUseChat).toHaveBeenLastCalledWith(
        expect.objectContaining({ gradeLevel: "high_school" })
      );
    });
  });

  // ── 応答レベルの取得と useChat への反映（要件6.3） ──

  describe("応答レベルの取得と useChat への反映（要件6.3）", () => {
    it("useResponseLevel が返す応答レベル（advanced）が useChat に渡される", () => {
      setupMocks({ messages: [], responseLevel: "advanced" });

      render(<ChatPage />);

      expect(mockUseChat).toHaveBeenCalledWith(
        expect.objectContaining({ responseLevel: "advanced" })
      );
    });

    it("useResponseLevel が返す応答レベル（basic）が useChat に渡される", () => {
      setupMocks({ messages: [], responseLevel: "basic" });

      render(<ChatPage />);

      expect(mockUseChat).toHaveBeenCalledWith(
        expect.objectContaining({ responseLevel: "basic" })
      );
    });

    it("設定画面で応答レベルを変更後にチャット画面へ戻ると、変更後の応答レベルが useChat に渡される（要件6.3）", () => {
      setupMocks({ messages: [], responseLevel: "basic" });

      const { rerender } = render(<ChatPage />);

      expect(mockUseChat).toHaveBeenLastCalledWith(
        expect.objectContaining({ responseLevel: "basic" })
      );

      // 設定画面で advanced に変更してチャット画面へ戻った状態を模擬
      // （ChatPage 再マウント時に useResponseLevel が新しい保存値を返す）
      setupMocks({ messages: [], responseLevel: "advanced" });

      rerender(<ChatPage />);

      expect(mockUseChat).toHaveBeenLastCalledWith(
        expect.objectContaining({ responseLevel: "advanced" })
      );
    });
  });
});
