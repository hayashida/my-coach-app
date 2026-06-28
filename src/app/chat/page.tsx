"use client";

import { useChat } from "@/hooks/use-chat";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { LogoutButton } from "@/components/auth/logout-button";

export default function ChatPage() {
  const { messages, isStreaming, error, sendMessage } = useChat();

  return (
    <div className="flex h-screen flex-col">
      {/* ヘッダー */}
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-lg font-semibold">AI コーチ</h1>
        <LogoutButton />
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
      <ChatInput onSubmit={sendMessage} disabled={isStreaming} />
    </div>
  );
}
