import { useRef, useState } from "react";
import { Message } from "@/types/message";

export interface UseChatReturn {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
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

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ref で常に最新の messages を同期的に参照できるようにする
  const messagesRef = useRef<Message[]>([]);

  // state と ref を同時に更新するヘルパー
  const updateMessages = (updater: (prev: Message[]) => Message[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
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

    try {
      // 6. POST /api/chat（historySnapshot を使って二重送信防止）
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: historySnapshot }),
      });

      // 9. HTTP エラー処理
      if (!response.ok) {
        setError(getErrorMessage(response.status));
        setIsStreaming(false);
        return;
      }

      // 7. ストリーミングレスポンスを ReadableStream として読み取り、追記
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
    } catch {
      setError(getErrorMessage(0));
    } finally {
      // 8. 完了後 isStreaming = false
      setIsStreaming(false);
    }
  };

  return { messages, isStreaming, error, sendMessage };
}
