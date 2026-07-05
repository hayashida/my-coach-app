/**
 * @jest-environment jsdom
 *
 * grade-level-coaching ゴールデンパス統合テスト（タスク 4.1）
 *
 * 「学年レベル設定 → チャット送信 → 学年レベルに応じた AI コーチ応答」までの
 * 一連の流れを、個々のユニットではなく実際の (モックしない) モジュールを
 * 通しで結線して検証する:
 *   SettingsPage → useGradeLevel → localStorage
 *   ChatPage → useGradeLevel → useChat → POST /api/chat（実ハンドラ）
 *   → buildSystemPrompt → Gemini（chats.create の呼び出し引数）
 *
 * モックするのは真の外部境界のみ:
 *   - @google/genai（Gemini SDK）
 *   - @/auth（認証セッション）
 *   - fetch（jsdom には実サーバーがないため、実 POST ハンドラに委譲する形でモック）
 *   - ゴールデンパスに無関係な UI 部品（SessionDrawer, ChatMessage, ReadonlyBanner,
 *     ChatInput の見た目）。ただし ChatInput の送信コールバック自体はそのまま呼び出す。
 *
 * カバー要件: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import ChatPage from "@/app/chat/page";
import SettingsPage from "@/app/settings/page";
import { POST } from "@/app/api/chat/route";
import { buildSystemPrompt } from "@/lib/system-prompt";

const GRADE_LEVEL_KEY = "coach_grade_level";

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

describe("学年レベル設定からチャット応答までのゴールデンパス（タスク4.1）", () => {
  test("学年レベル未設定の初回利用時、中学生向けの指示でAIコーチが応答する（要件1.2, 3.1）", async () => {
    const mockCreate = setupGenAIMock();

    render(<ChatPage />);

    fireEvent.click(screen.getByTestId("send-btn"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { systemInstruction: buildSystemPrompt("junior_high") },
      })
    );
  });

  test("設定画面から学年レベルを高校生に変更して保存し、チャット画面でメッセージを送信すると、変更後の学年レベルに応じた指示でAIコーチが応答する（要件2.1, 2.2, 2.3, 3.2, 3.3）", async () => {
    const mockCreate = setupGenAIMock();

    // 1. 設定画面で「高校生」を選択して保存する（実際の SettingsPage + useGradeLevel + localStorage を経由）
    const { unmount } = render(<SettingsPage />);

    fireEvent.click(screen.getByRole("radio", { name: "高校生" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(localStorage.getItem(GRADE_LEVEL_KEY)).toBe("high_school");

    unmount();

    // 2. チャット画面に戻る（ChatPage 再マウントで /settings からの遷移後を模擬）
    render(<ChatPage />);

    fireEvent.click(screen.getByTestId("send-btn"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { systemInstruction: buildSystemPrompt("high_school") },
      })
    );
  });
});
