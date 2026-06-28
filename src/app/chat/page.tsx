"use client";

import { useRef, useState } from "react";
import { useChat } from "@/hooks/use-chat";
import { useSessionStorage } from "@/hooks/use-session-storage";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { LogoutButton } from "@/components/auth/logout-button";

export default function ChatPage() {
  const { initialSessionData, saveCurrentSession, archiveCurrentSession } =
    useSessionStorage();

  // セッションID（null = まだメッセージを送っていない空の状態）
  const currentSessionIdRef = useRef<string | null>(
    initialSessionData?.sessionId ?? null
  );
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => initialSessionData?.sessionId ?? null
  );

  const { messages, isStreaming, error, sendMessage, clearMessages } = useChat({
    initialMessages: initialSessionData?.messages ?? [],
    onStreamComplete: (msgs) => {
      if (currentSessionIdRef.current) {
        saveCurrentSession(currentSessionIdRef.current, msgs);
      }
    },
  });

  // stale closure 対策: ref を即時更新してから sendMessage を呼ぶ
  const handleSendMessage = async (text: string) => {
    if (!currentSessionIdRef.current) {
      const id = crypto.randomUUID();
      currentSessionIdRef.current = id; // ref を即時更新
      setCurrentSessionId(id); // state は非同期更新
    }
    await sendMessage(text);
  };

  // 「新しい会話」disabled 条件
  const isNewChatDisabled = isStreaming || messages.length === 0;

  const handleNewChat = () => {
    archiveCurrentSession(currentSessionIdRef.current, messages);
    clearMessages();
    currentSessionIdRef.current = null;
    setCurrentSessionId(null);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* ヘッダー */}
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-lg font-semibold">AI コーチ</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            disabled={isNewChatDisabled}
            className="rounded-md px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            新しい会話
          </button>
          <LogoutButton />
        </div>
      </header>

      {/* メッセージリスト */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}
        {/* エラー表示 */}
        {error && (
          <div className="rounded-lg bg-red-100 p-3 text-red-700 text-sm">
            {error}
          </div>
        )}
      </main>

      {/* 入力欄 */}
      <ChatInput onSubmit={handleSendMessage} disabled={isStreaming} />
    </div>
  );
}
