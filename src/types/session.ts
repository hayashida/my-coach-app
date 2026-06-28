import type { Message } from "@/types/message";

export interface Session {
  id: string; // crypto.randomUUID() で生成（最初のメッセージ送信時）
  createdAt: number; // Date.now() — eviction の優先度に使用
  messages: Message[]; // chat-core の Message 型を参照
}
