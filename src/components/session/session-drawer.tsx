'use client';

import { useTransition } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import type { Session } from "@/types/session";
import { SessionListItem } from "@/components/session/session-list-item";
import { signOutAction } from "@/components/auth/actions";
import { clearSessionStorage } from "@/hooks/use-session-storage";

interface SessionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  onSelectSession: (session: Session) => void;
  onNewChat: () => void;
  isNewChatDisabled: boolean;
}

export function SessionDrawer({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  onNewChat,
  isNewChatDisabled,
}: SessionDrawerProps) {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    clearSessionStorage();
    startTransition(() => { signOutAction(); });
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/30" />
        <Dialog.Popup className="fixed right-0 top-0 h-full w-64 bg-white shadow-xl">
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">AI コーチ</h2>
            </div>
            <button
              onClick={() => { onNewChat(); onClose(); }}
              disabled={isNewChatDisabled}
              className="w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors border-b border-gray-200 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              新しい会話
            </button>
            <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">過去の会話</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500 text-center">
                  まだ保存済みの会話がありません
                </p>
              ) : (
                sessions.map((session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    onSelect={() => onSelectSession(session)}
                  />
                ))
              )}
            </div>
            <Link
              href="/settings"
              onClick={onClose}
              className="block w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors border-t border-gray-200 text-sm text-gray-700"
            >
              学年レベル・応答レベル設定
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isPending}
              className="w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors border-t border-gray-200 text-sm text-gray-700 disabled:opacity-50"
            >
              ログアウト
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
