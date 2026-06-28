/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useChat } from "../use-chat";

beforeEach(() => {
  process.env.ENABLE_USE_CHAT = "true";
  jest.clearAllMocks();
});

afterEach(() => {
  delete process.env.ENABLE_USE_CHAT;
});

describe("useChat", () => {
  describe("空入力ガード", () => {
    it("sendMessage('') を呼ぶと fetch が呼ばれない", async () => {
      global.fetch = jest.fn();
      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("");
      });

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("HTTPエラーハンドリング", () => {
    it("401 エラー時に日本語エラーメッセージをセットし isStreaming が false になる", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        body: null,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("テスト");
      });

      expect(result.current.error).toBe(
        "セッションが切れました。再度ログインしてください。"
      );
      expect(result.current.isStreaming).toBe(false);
    });

    it("429 エラー時に日本語エラーメッセージをセットし isStreaming が false になる", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        body: null,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("テスト");
      });

      expect(result.current.error).toBe(
        "リクエスト制限に達しました。しばらく待ってから再試行してください。"
      );
      expect(result.current.isStreaming).toBe(false);
    });

    it("500 エラー時に日本語エラーメッセージをセットし isStreaming が false になる", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        body: null,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("テスト");
      });

      expect(result.current.error).toBe(
        "エラーが発生しました。もう一度お試しください。"
      );
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe("ストリーミング状態管理", () => {
    it("送信完了後に isStreaming が false になり assistant メッセージが追記される", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("テスト返答"));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("こんにちは");
      });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]).toEqual({
        role: "user",
        content: "こんにちは",
      });
      expect(result.current.messages[1]).toEqual({
        role: "assistant",
        content: "テスト返答",
      });
    });

    it("history スナップショットを使って POST される（二重送信防止）", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("返答"));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      });

      const { result } = renderHook(() => useChat());

      // 1回目の送信
      await act(async () => {
        await result.current.sendMessage("最初のメッセージ");
      });

      const stream2 = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("2回目の返答"));
          controller.close();
        },
      });
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        body: stream2,
      });

      // 2回目の送信 - history には1回目の会話が含まれる
      await act(async () => {
        await result.current.sendMessage("2回目のメッセージ");
      });

      const secondCallArgs = (fetch as jest.Mock).mock.calls[1];
      const secondBody = JSON.parse(secondCallArgs[1].body as string);

      // history には最初のメッセージとアシスタントの返答が含まれるべき
      expect(secondBody.history).toHaveLength(2);
      expect(secondBody.history[0]).toEqual({
        role: "user",
        content: "最初のメッセージ",
      });
      expect(secondBody.message).toBe("2回目のメッセージ");
    });
  });
});
