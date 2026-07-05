/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";
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

  describe("UseChatOptions - initialMessages", () => {
    it("initialMessages を指定した場合、messages の初期値が指定値になる（要件 1.2）", () => {
      const initial = [
        { role: "user" as const, content: "こんにちは" },
        { role: "assistant" as const, content: "はじめまして" },
      ];
      const { result } = renderHook(() => useChat({ initialMessages: initial }));
      expect(result.current.messages).toEqual(initial);
    });

    it("initialMessages を指定しない場合、messages の初期値が空配列になる（後方互換）", () => {
      const { result } = renderHook(() => useChat());
      expect(result.current.messages).toEqual([]);
    });

    it("initialMessages に空配列を指定した場合、messages の初期値が空配列になる", () => {
      const { result } = renderHook(() => useChat({ initialMessages: [] }));
      expect(result.current.messages).toEqual([]);
    });
  });

  describe("UseChatOptions - onStreamComplete", () => {
    it("ストリーミングが正常完了後に onStreamComplete が最新 messages を引数に呼ばれる（要件 1.1）", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("返答テキスト"));
          controller.close();
        },
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      });

      const onStreamComplete = jest.fn();
      const { result } = renderHook(() => useChat({ onStreamComplete }));

      await act(async () => {
        await result.current.sendMessage("テスト送信");
      });

      expect(onStreamComplete).toHaveBeenCalledTimes(1);
      const calledWith = onStreamComplete.mock.calls[0][0];
      expect(calledWith).toHaveLength(2);
      expect(calledWith[0]).toEqual({ role: "user", content: "テスト送信" });
      expect(calledWith[1]).toEqual({ role: "assistant", content: "返答テキスト" });
    });

    it("HTTP 401 エラー時に onStreamComplete が呼ばれない（要件 1.4）", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        body: null,
      });

      const onStreamComplete = jest.fn();
      const { result } = renderHook(() => useChat({ onStreamComplete }));

      await act(async () => {
        await result.current.sendMessage("テスト");
      });

      expect(onStreamComplete).not.toHaveBeenCalled();
    });

    it("HTTP 429 エラー時に onStreamComplete が呼ばれない（要件 1.4）", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        body: null,
      });

      const onStreamComplete = jest.fn();
      const { result } = renderHook(() => useChat({ onStreamComplete }));

      await act(async () => {
        await result.current.sendMessage("テスト");
      });

      expect(onStreamComplete).not.toHaveBeenCalled();
    });

    it("HTTP 500 エラー時に onStreamComplete が呼ばれない（要件 1.4）", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        body: null,
      });

      const onStreamComplete = jest.fn();
      const { result } = renderHook(() => useChat({ onStreamComplete }));

      await act(async () => {
        await result.current.sendMessage("テスト");
      });

      expect(onStreamComplete).not.toHaveBeenCalled();
    });

    it("ネットワーク例外発生時に onStreamComplete が呼ばれない（要件 1.3）", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      const onStreamComplete = jest.fn();
      const { result } = renderHook(() => useChat({ onStreamComplete }));

      await act(async () => {
        await result.current.sendMessage("テスト");
      });

      expect(onStreamComplete).not.toHaveBeenCalled();
    });
  });

  describe("clearMessages", () => {
    it("clearMessages 呼び出し後に messages が空配列になる（要件 2.2）", async () => {
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

      await act(async () => {
        await result.current.sendMessage("こんにちは");
      });

      expect(result.current.messages).toHaveLength(2);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
    });

    it("clearMessages 後に sendMessage を呼ぶと history が空でリクエストされる", async () => {
      const stream1 = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("返答1"));
          controller.close();
        },
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream1,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("最初のメッセージ");
      });

      act(() => {
        result.current.clearMessages();
      });

      const stream2 = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("返答2"));
          controller.close();
        },
      });
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        body: stream2,
      });

      await act(async () => {
        await result.current.sendMessage("新しいメッセージ");
      });

      const secondCallBody = JSON.parse(
        (fetch as jest.Mock).mock.calls[1][1].body as string
      );
      // clearMessages 後は history が空（messagesRef もリセット済み）
      expect(secondCallBody.history).toHaveLength(0);
    });
  });

  describe("sendImage", () => {
    const mockImage = { data: "base64encodeddata", mimeType: "image/jpeg" as const };

    it("sendImage 呼び出し後に messages に {role:'user', content:'[写真]', image:{...}} が追加される（要件 3.1）", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("画像の説明"));
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
        await result.current.sendImage(mockImage);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]).toEqual({
        role: "user",
        content: "[写真]",
        image: { data: "base64encodeddata", mimeType: "image/jpeg" },
      });
      expect(result.current.messages[1]).toEqual({
        role: "assistant",
        content: "画像の説明",
      });
    });

    it("sendImage ストリーミング完了後に onStreamComplete が最新 messages を引数に呼ばれる（要件 3.3）", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("画像の返答"));
          controller.close();
        },
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      });

      const onStreamComplete = jest.fn();
      const { result } = renderHook(() => useChat({ onStreamComplete }));

      await act(async () => {
        await result.current.sendImage(mockImage);
      });

      expect(onStreamComplete).toHaveBeenCalledTimes(1);
      const calledWith = onStreamComplete.mock.calls[0][0];
      expect(calledWith).toHaveLength(2);
      expect(calledWith[0]).toEqual({
        role: "user",
        content: "[写真]",
        image: { data: "base64encodeddata", mimeType: "image/jpeg" },
      });
      expect(calledWith[1]).toEqual({ role: "assistant", content: "画像の返答" });
    });

    it("sendImage で 429 エラー時に適切な日本語エラーメッセージが error state にセットされる（要件 4.1, 4.2）", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        body: null,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendImage(mockImage);
      });

      expect(result.current.error).toBe(
        "リクエスト制限に達しました。しばらく待ってから再試行してください。"
      );
      expect(result.current.isStreaming).toBe(false);
    });

    it("sendImage で POST body に image と history が含まれる（要件 3.3）", async () => {
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

      await act(async () => {
        await result.current.sendImage(mockImage);
      });

      const callArgs = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.image).toEqual({ data: "base64encodeddata", mimeType: "image/jpeg" });
      expect(body.history).toEqual([]);
    });
  });

  describe("ストリーミング状態管理", () => {
    it("送信中は isStreaming が true になり、完了後は false になる（要件 5.1 / 5.2）", async () => {
      // ストリームの読み取りを一時停止させ、isStreaming === true の状態を観測できるようにする
      let resolveChunk!: () => void;
      const chunkReady = new Promise<void>((resolve) => {
        resolveChunk = resolve;
      });

      const pausedStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          await chunkReady; // resolveChunk() が呼ばれるまでストリームを停止
          controller.enqueue(new TextEncoder().encode("テスト"));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: pausedStream,
      });

      const { result } = renderHook(() => useChat());

      // sendMessage を開始するが完了を待たない
      // 同期 act() で sendMessage 呼び出し前の初期状態更新（setIsStreaming, setMessages）を包む
      // ストリームが停止中のため sendMessage は reader.read() で suspended のまま
      act(() => {
        void result.current.sendMessage("こんにちは");
      });

      // isStreaming が true になるまで waitFor でポーリング（要件 5.1）
      await waitFor(() => {
        expect(result.current.isStreaming).toBe(true);
      });

      // ストリームを完了させる
      await act(async () => {
        resolveChunk();
        await new Promise<void>((r) => setTimeout(r, 50));
      });

      // 完了後は isStreaming が false（要件 5.2）
      await waitFor(() => {
        expect(result.current.isStreaming).toBe(false);
      });
    });

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

  describe("UseChatOptions - gradeLevel（要件 3.3）", () => {
    it("sendMessage で gradeLevel オプションを指定すると POST body に含まれる", async () => {
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

      const { result } = renderHook(() => useChat({ gradeLevel: "high_school" }));

      await act(async () => {
        await result.current.sendMessage("テスト送信");
      });

      const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body as string);
      expect(body.gradeLevel).toBe("high_school");
    });

    it("sendImage で gradeLevel オプションを指定すると POST body に含まれる", async () => {
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

      const mockImage = { data: "base64encodeddata", mimeType: "image/jpeg" as const };
      const { result } = renderHook(() => useChat({ gradeLevel: "junior_high" }));

      await act(async () => {
        await result.current.sendImage(mockImage);
      });

      const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body as string);
      expect(body.gradeLevel).toBe("junior_high");
    });

    it("gradeLevel を指定しない場合、POST body に gradeLevel フィールドが含まれない（後方互換）", async () => {
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

      await act(async () => {
        await result.current.sendMessage("テスト送信");
      });

      const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body as string);
      expect(body.gradeLevel).toBeUndefined();
    });
  });
});
