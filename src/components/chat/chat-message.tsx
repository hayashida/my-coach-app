"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Message } from "@/types/message";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-lg px-4 py-2 max-w-[80%] ${
          isUser
            ? "bg-blue-500 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        {isUser && message.image ? (
          <img
            src={`data:${message.image.mimeType};base64,${message.image.data}`}
            alt="送信した写真"
            className="max-w-full rounded-lg"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = "none";
              const fallback = document.createElement("span");
              fallback.textContent = "[写真の表示に失敗しました]";
              target.parentNode?.insertBefore(fallback, target.nextSibling);
            }}
          />
        ) : isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <Markdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code({ className, children, ...props }) {
                const isInline = !className;
                return isInline ? (
                  <code
                    className="bg-gray-200 text-gray-800 rounded px-1 py-0.5 text-sm font-mono"
                    {...props}
                  >
                    {children}
                  </code>
                ) : (
                  <code
                    className={`block bg-gray-200 text-gray-800 rounded p-2 text-sm font-mono overflow-x-auto ${className ?? ""}`}
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </Markdown>
        )}
      </div>
    </div>
  );
}
