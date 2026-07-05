/**
 * @jest-environment jsdom
 *
 * grade-level-coaching ゴールデンパス統合テスト（タスク 8.1）
 *
 * 「応答レベル設定 → チャット送信 → 応答レベルに応じた AI コーチ応答」までの
 * 一連の流れを、個々のユニットではなく実際の (モックしない) モジュールを
 * 通しで結線して検証する:
 *   SettingsPage → useResponseLevel → localStorage
 *   ChatPage → useResponseLevel → useChat → POST /api/chat（実ハンドラ）
 *   → buildSystemPrompt → Gemini（chats.create の呼び出し引数）
 *
 * モックするのは真の外部境界のみ:
 *   - @google/genai（Gemini SDK）
 *   - @/auth（認証セッション）
 *   - fetch（jsdom には実サーバーがないため、実 POST ハンドラに委譲する形でモック）
 *   - ゴールデンパスに無関係な UI 部品（SessionDrawer, ChatMessage, ReadonlyBanner,
 *     ChatInput の見た目）。ただし ChatInput の送信コールバック自体はそのまま呼び出す。
 *
 * カバー要件: 2.1, 2.4, 2.5, 6.1, 6.2, 6.3
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import ChatPage from "@/app/chat/page";
import SettingsPage from "@/app/settings/page";
import { POST } from "@/app/api/chat/route";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { DEFAULT_GRADE_LEVEL } from "@/types/grade-level";
import { DEFAULT_RESPONSE_LEVEL } from "@/types/response-level";

const RESPONSE_LEVEL_KEY = "coach_response_level";

// ─── 真の外部境界のモック ───────────────────────────────────────────

jest.mock("@/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { email: "test@example.com" } }),
}));

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(),
}));

// ─── ゴールデンパスに無関係な UI 部品のモック ───────────────────────
// （@base-ui/react/dialog・react-markdown 等、この検証と無関係な依存を排除する）

jest.mock("@/components/session/session-drawer", () => ({
  SessionDrawer: () => null,
}));

jest.mock("@/components/session/readonly-banner", () => ({
  ReadonlyBanner: () => null,
}));

jest.mock("@/components/chat/chat-message", () => ({
  ChatMessage: ({ message }: { message: { role: string; content: string } }) => (
    <div data-testid={`message-${message.role}`}>{message.content}</div>
  ),
}));

jest.mock("@/components/chat/chat-input", () => ({
  ChatInput: ({ onSubmit }: { onSubmit: (text: string) => void }) => (
    <button
      data-testid="send-btn"
      onClick={() => onSubmit("二次方程式の解き方を教えて")}
    >
      送信
    </button>
  ),
}));

// ─── ヘルパー ──────────────────────────────────────────────────────

/** @google/genai の chats.create をモックし、呼び出し引数を検証できるようにする */
function setupGenAIMock(): jest.Mock {
  const mockCreate = jest.fn().mockReturnValue({
    sendMessageStream: jest.fn().mockResolvedValue(
      (async function* () {
        yield { text: "AIコーチからの返答" };
      })()
    ),
  });
  (GoogleGenAI as unknown as jest.Mock).mockImplementation(() => ({
    chats: { create: mockCreate },
  }));
  return mockCreate;
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();

  // fetch("/api/chat", ...) を実際の POST ハンドラへ委譲する。
  // jsdom には実サーバーが存在しないため、ネットワーク層のみを薄く繋ぎ直す。
  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const request = new Request(
        `http://localhost${url}`,
        init
      ) as unknown as NextRequest;
      return POST(request);
    }
  ) as unknown as typeof fetch;
});

describe("応答レベル設定からチャット応答までのゴールデンパス（タスク8.1）", () => {
  test("応答レベル未設定の初回利用時、基本レベル向けのヒントでAIコーチが応答する（要件6.1）", async () => {
    const mockCreate = setupGenAIMock();

    render(<ChatPage />);

    fireEvent.click(screen.getByTestId("send-btn"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          systemInstruction: buildSystemPrompt(
            DEFAULT_GRADE_LEVEL,
            DEFAULT_RESPONSE_LEVEL
          ),
        },
      })
    );
  });

  test("設定画面から応答レベルを応用に変更して保存し、チャット画面でメッセージを送信すると、変更後の応答レベルに応じたヒントでAIコーチが応答する（要件2.1, 2.4, 2.5, 6.2, 6.3）", async () => {
    const mockCreate = setupGenAIMock();

    // 1. 設定画面で「応用」を選択して保存する（実際の SettingsPage + useResponseLevel + localStorage を経由）
    const { unmount } = render(<SettingsPage />);

    fireEvent.click(screen.getByRole("radio", { name: "応用" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(localStorage.getItem(RESPONSE_LEVEL_KEY)).toBe("advanced");

    unmount();

    // 2. チャット画面に戻る（ChatPage 再マウントで /settings からの遷移後を模擬）
    render(<ChatPage />);

    fireEvent.click(screen.getByTestId("send-btn"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          systemInstruction: buildSystemPrompt(DEFAULT_GRADE_LEVEL, "advanced"),
        },
      })
    );
  });
});
