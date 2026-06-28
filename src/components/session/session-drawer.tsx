'use client';

import { Dialog } from "@base-ui/react/dialog";
import type { Session } from "@/types/session";
import { SessionListItem } from "@/components/session/session-list-item";

interface SessionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  onSelectSession: (session: Session) => void;
}

export function SessionDrawer({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
}: SessionDrawerProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/30" />
        <Dialog.Popup className="fixed left-0 top-0 h-full w-64 bg-white shadow-xl">
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">過去の会話</h2>
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
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
