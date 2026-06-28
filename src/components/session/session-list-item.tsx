'use client';

import type { Session } from "@/types/session";

interface SessionListItemProps {
  session: Session;
  onSelect: () => void;
}

export function SessionListItem({ session, onSelect }: SessionListItemProps) {
  const firstUserMessage = session.messages.find((m) => m.role === "user");

  let preview: string;
  if (!firstUserMessage) {
    preview = "（メッセージなし）";
  } else if (firstUserMessage.content.length > 30) {
    preview = firstUserMessage.content.slice(0, 30) + "...";
  } else {
    preview = firstUserMessage.content;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors border-b border-gray-200 text-sm text-gray-700 truncate"
    >
      {preview}
    </button>
  );
}
