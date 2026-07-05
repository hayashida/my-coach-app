"use client";

import { useRef, useState } from "react";
import { useChat } from "@/hooks/use-chat";
import { useSessionStorage } from "@/hooks/use-session-storage";
import { useGradeLevel } from "@/hooks/use-grade-level";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { SessionDrawer } from "@/components/session/session-drawer";
import { ReadonlyBanner } from "@/components/session/readonly-banner";
import type { Session } from "@/types/session";
import type { CompressedImage } from "@/lib/image-compression";

export default function ChatPage() {
  const { initialSessionData, saveCurrentSession, archiveCurrentSession, pastSessions } =
    useSessionStorage();
  const { gradeLevel } = useGradeLevel();

  // セッションID（null = まだメッセージを送っていない空の状態）
  const currentSessionIdRef = useRef<string | null>(
    initialSessionData?.sessionId ?? null
  );
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => initialSessionData?.sessionId ?? null
  );

  // 読み取り専用モードで閲覧中のセッション
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  // ドロワー開閉状態
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { messages, isStreaming, error, sendMessage, sendImage, clearMessages } = useChat({
    initialMessages: initialSessionData?.messages ?? [],
    gradeLevel,
    onStreamComplete: (msgs) => {
      if (currentSessionIdRef.current) {
        saveCurrentSession(currentSessionIdRef.current, msgs);
      }
    },
  });

  // 読み取り専用モード中は viewingSession のメッセージを表示
  const displayMessages = viewingSession ? viewingSession.messages : messages;

  // stale closure 対策: ref を即時更新してから sendMessage を呼ぶ
  const handleSendMessage = async (text: string) => {
    if (!currentSessionIdRef.current) {
      const id = crypto.randomUUID();
      currentSessionIdRef.current = id; // ref を即時更新
      setCurrentSessionId(id); // state は非同期更新
    }
    await sendMessage(text);
  };

  const handleSendImage = async (image: CompressedImage) => {
    if (!currentSessionIdRef.current) {
      const id = crypto.randomUUID();
      currentSessionIdRef.current = id;
      setCurrentSessionId(id);
    }
    await sendImage(image);
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
        <button
          onClick={() => setIsDrawerOpen(true)}
          aria-label="メニューを開く"
          className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
        >
          ☰
        </button>
      </header>

      {/* 読み取り専用バナー */}
      {viewingSession !== null && (
        <ReadonlyBanner onReturn={() => setViewingSession(null)} />
      )}

      {/* メッセージリスト */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {displayMessages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}
        {/* エラー表示 */}
        {error && (
          <div className="rounded-lg bg-red-100 p-3 text-red-700 text-sm">
            {error}
          </div>
        )}
      </main>

      {/* 入力欄（読み取り専用モード中は非表示） */}
      {viewingSession === null && (
        <ChatInput
          onSubmit={handleSendMessage}
          onImageSubmit={handleSendImage}
          disabled={isStreaming}
        />
      )}

      {/* セッションドロワー */}
      <SessionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        sessions={pastSessions}
        onSelectSession={(session) => {
          setViewingSession(session);
          setIsDrawerOpen(false);
        }}
        onNewChat={handleNewChat}
        isNewChatDisabled={isNewChatDisabled}
      />
    </div>
  );
}
