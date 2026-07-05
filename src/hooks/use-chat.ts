import { useRef, useState } from "react";
import { Message } from "@/types/message";
import type { CompressedImage } from "@/lib/image-compression";
import type { GradeLevel } from "@/types/grade-level";

export interface UseChatOptions {
  // マウント時の初期メッセージ（localStorage 復元用）
  initialMessages?: Message[];
  // 呼び出し元（ChatPage）が useGradeLevel から取得して渡す学年レベル。
  // 未指定の場合は POST body に含めず、サーバー側のデフォルトフォールバックに委ねる。
  gradeLevel?: GradeLevel;
  // ストリーミングがエラーなしで完了した後に呼ばれるコールバック
  onStreamComplete?: (messages: Message[]) => void;
}

export interface UseChatReturn {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  sendImage: (image: CompressedImage) => Promise<void>;
  clearMessages: () => void;
}

function getErrorMessage(status: number): string {
  if (status === 401) {
    return "セッションが切れました。再度ログインしてください。";
  }
  if (status === 429) {
    return "リクエスト制限に達しました。しばらく待ってから再試行してください。";
  }
  return "エラーが発生しました。もう一度お試しください。";
}

export function useChat(options?: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>(
    options?.initialMessages ?? []
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ref で常に最新の messages を同期的に参照できるようにする
  const messagesRef = useRef<Message[]>(options?.initialMessages ?? []);

  // state と ref を同時に更新するヘルパー
  // messagesRef.current を source of truth として同期的に更新し、setMessages に結果を渡す
  const updateMessages = (updater: (prev: Message[]) => Message[]) => {
    const next = updater(messagesRef.current);
    messagesRef.current = next;
    setMessages(next);
  };

  const clearMessages = (): void => {
    setMessages([]);
    messagesRef.current = [];
  };

  /**
   * ストリーミングレスポンスを受信して assistant メッセージに追記する共通ループ。
   * 成功時は true を返し、HTTP エラー時は false を返してエラー state をセットする。
   */
  const readStream = async (response: Response): Promise<boolean> => {
    if (!response.ok) {
      setError(getErrorMessage(response.status));
      setIsStreaming(false);
      return false;
    }

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          const chunk = decoder.decode(result.value);
          updateMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + chunk,
              };
            }
            return updated;
          });
        }
      }
    }

    return true;
  };

  const sendMessage = async (text: string): Promise<void> => {
    // 1. 空入力ガード
    if (text === "") {
      return;
    }

    // 2. 呼び出し時点の messages を同期的にスナップショット（二重送信防止）
    const historySnapshot: Message[] = [...messagesRef.current];

    // 3. ユーザーメッセージを追加
    updateMessages((prev) => [...prev, { role: "user", content: text }]);

    // 4. ストリーミング開始、エラークリア
    setIsStreaming(true);
    setError(null);

    // 5. 空の assistant メッセージを追加
    updateMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    let streamCompletedSuccessfully = false;

    try {
      // 6. POST /api/chat（historySnapshot を使って二重送信防止）
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: historySnapshot,
          gradeLevel: options?.gradeLevel,
        }),
      });

      streamCompletedSuccessfully = await readStream(response);
    } catch {
      setError(getErrorMessage(0));
    } finally {
      // 7. 完了後 isStreaming = false
      setIsStreaming(false);

      // onStreamComplete はエラーなし完了時のみ呼ぶ
      if (streamCompletedSuccessfully && options?.onStreamComplete) {
        options.onStreamComplete(messagesRef.current);
      }
    }
  };

  const sendImage = async (image: CompressedImage): Promise<void> => {
    // 1. 呼び出し時点の messages をスナップショット（ユーザーメッセージ追加前）
    const historySnapshot: Message[] = [...messagesRef.current];

    // 2. 画像ユーザーメッセージを追加
    updateMessages((prev) => [
      ...prev,
      { role: "user", content: "[写真]", image: { data: image.data, mimeType: image.mimeType } },
    ]);

    // 3. ストリーミング開始、エラークリア
    setIsStreaming(true);
    setError(null);

    // 4. 空の assistant メッセージを追加
    updateMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    let streamCompletedSuccessfully = false;

    try {
      // 5. POST /api/chat with image payload
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: { data: image.data, mimeType: image.mimeType },
          history: historySnapshot,
          gradeLevel: options?.gradeLevel,
        }),
      });

      streamCompletedSuccessfully = await readStream(response);
    } catch {
      setError(getErrorMessage(0));
    } finally {
      // 6. 完了後 isStreaming = false
      setIsStreaming(false);

      // onStreamComplete はエラーなし完了時のみ呼ぶ
      if (streamCompletedSuccessfully && options?.onStreamComplete) {
        options.onStreamComplete(messagesRef.current);
      }
    }
  };

  return { messages, isStreaming, error, sendMessage, sendImage, clearMessages };
}
