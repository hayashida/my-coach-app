/**
 * @jest-environment jsdom
 *
 * grade-level-coaching 保存失敗時の継続動作 統合テスト（タスク 4.2）
 *
 * 要件4.1「学年レベルの保存処理が失敗した場合（端末側のストレージが利用できない場合など）、
 * システムはチャット機能の利用をブロックせず、デフォルトまたは直前まで有効だった学年レベルで
 * 動作を継続する」を、ユニット（use-grade-level.ts単体）ではなく
 * SettingsPage → ChatPage という実際の画面遷移フローを通しで検証する。
 *
 * localStorage.setItem をスローするようにモックし（Safari プライベートモード等の
 * QuotaExceededError を模擬）:
 *   1. SettingsPage で学年レベルを変更して保存しても、操作がクラッシュせず
 *      in-memory の表示が新しい選択値に更新されること（保存失敗はサイレントキャッチされる）
 *   2. その後 ChatPage でメッセージを送信しても、チャット機能自体はブロックされず
 *      （デフォルトの学年レベルにフォールバックして）正常に応答が返ってくること
 *
 * モックするのは真の外部境界のみ（grade-level-golden-path.test.tsx と同じ方針）:
 *   - @google/genai（Gemini SDK）
 *   - @/auth（認証セッション）
 *   - fetch（jsdom には実サーバーがないため、実 POST ハンドラに委譲する形でモック）
 *   - ゴールデンパスに無関係な UI 部品（SessionDrawer, ChatMessage, ReadonlyBanner,
 *     ChatInput の見た目）。ただし ChatInput の送信コールバック自体はそのまま呼び出す。
 *
 * use-grade-level.ts / settings/page.tsx / chat/page.tsx は変更しない（実装済みコードをそのまま検証する）。
 *
 * カバー要件: 4.1
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

const GRADE_LEVEL_KEY = "coach_grade_level";

// ─── 真の外部境界のモック ───────────────────────────────────────────

jest.mock("@/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { email: "test@example.com" } }),
}));

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// ─── ゴールデンパスに無関係な UI 部品のモック ───────────────────────

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

let setItemSpy: jest.SpyInstance;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();

  // fetch("/api/chat", ...) を実際の POST ハンドラへ委譲する。
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

  // 端末側のストレージが利用できない状況を模擬する（Safari プライベートモード等の
  // QuotaExceededError を模したスロー）。
  setItemSpy = jest
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });
});

afterEach(() => {
  setItemSpy.mockRestore();
});

describe("学年レベル保存失敗時の継続動作（タスク4.2、要件4.1）", () => {
  test("ストレージ書き込みが失敗しても設定画面の保存操作はクラッシュせず、UIには選択した値が即座に反映される", () => {
    render(<SettingsPage />);

    // 未設定時はデフォルト（中学生）表示から開始する
    expect(screen.getByTestId("current-grade-level").textContent).toBe("中学生");

    fireEvent.click(screen.getByRole("radio", { name: "高校生" }));

    // 保存操作自体が例外を外に漏らさないこと（サイレントキャッチされていること）
    expect(() => {
      fireEvent.click(screen.getByRole("button", { name: "保存" }));
    }).not.toThrow();

    // 永続化は失敗しているため localStorage には書き込まれていない
    expect(localStorage.getItem(GRADE_LEVEL_KEY)).toBeNull();

    // にもかかわらず、in-memory 状態は選択値に更新され、画面表示に反映される
    expect(screen.getByTestId("current-grade-level").textContent).toBe("高校生");
  });

  test("設定保存が失敗した後でもチャット送信はブロックされず、デフォルトの学年レベルで応答が継続する", async () => {
    const mockCreate = setupGenAIMock();

    // 1. 設定画面で学年レベル変更を試みるが、ストレージ書き込みは失敗する
    const { unmount } = render(<SettingsPage />);
    fireEvent.click(screen.getByRole("radio", { name: "高校生" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(localStorage.getItem(GRADE_LEVEL_KEY)).toBeNull();
    unmount();

    // 2. チャット画面に遷移してメッセージを送信する（ブロックされないことを確認する）
    render(<ChatPage />);

    expect(() => {
      fireEvent.click(screen.getByTestId("send-btn"));
    }).not.toThrow();

    // ストリーミング応答が正常に完了し、チャット機能自体は継続していること
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    await screen.findByText("AIコーチからの返答");

    // エラー表示（fetch失敗・401等）が出ていないこと = チャットがブロックされていないこと
    expect(
      screen.queryByText(/セッションが切れました|リクエスト制限|エラーが発生しました/)
    ).toBeNull();

    // 永続化に失敗していたため、デフォルトの学年レベル（直前まで有効だった値）で
    // 動作が継続していることを確認する（要件4.1）
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
});
