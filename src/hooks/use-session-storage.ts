import { useRef, useState } from "react";
import type { Message } from "@/types/message";
import type { Session } from "@/types/session";

const SESSIONS_KEY = "coach_sessions";
const CURRENT_ID_KEY = "coach_current_session_id";

export interface UseSessionStorageReturn {
  // 過去セッション（max 3, 最新順 = createdAt 降順、messages.length > 0 のみ）
  pastSessions: Session[];
  // マウント時に localStorage から同期読み込みされた初期データ
  // null = localStorage に現在のセッションなし（新規ユーザーまたは新しい会話後）
  initialSessionData: { sessionId: string; messages: Message[] } | null;
  // ストリーミング完了後に呼び出す（ADR-002: 1回書き込み）
  saveCurrentSession: (sessionId: string, messages: Message[]) => void;
  // 「新しい会話」押下時: 現在のセッションを格上げ + eviction + currentId クリア
  // messages.length === 0 の場合は格上げせず currentId のみクリア（ADR-001）
  archiveCurrentSession: (
    sessionId: string | null,
    messages: Message[]
  ) => void;
}

/** localStorage からセッション配列を読み込む。パース失敗時は空配列を返す。SSR 安全。 */
function readSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Session[];
  } catch {
    return [];
  }
}

/** セッション配列を localStorage に書き込む。SSR 安全。 */
function writeSessions(sessions: Session[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // 容量超過等のエラーはサイレント失敗
  }
}

/**
 * pastSessions の計算：messages.length > 0 のセッションのみ、
 * createdAt 降順、最大 3 件
 */
function computePastSessions(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.messages.length > 0)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);
}

/**
 * SSR 安全な同期初期化。
 * coach_current_session_id が指すセッションが coach_sessions に存在しない場合は null を返す。
 */
function readInitialSessionData(): {
  sessionId: string;
  messages: Message[];
} | null {
  if (typeof window === "undefined") return null;

  const currentId = localStorage.getItem(CURRENT_ID_KEY);
  if (!currentId) return null;

  const sessions = readSessions();
  const found = sessions.find((s) => s.id === currentId);
  if (!found) return null;

  return { sessionId: found.id, messages: found.messages };
}

export function useSessionStorage(): UseSessionStorageReturn {
  // initialSessionData は useRef で同期的に1回だけ計算する（SSR 安全）
  const initialSessionDataRef = useRef<{
    sessionId: string;
    messages: Message[];
  } | null>(readInitialSessionData());

  // pastSessions は初期値を localStorage から同期計算する
  const [pastSessions, setPastSessions] = useState<Session[]>(() =>
    computePastSessions(readSessions())
  );

  /**
   * saveCurrentSession: coach_sessions の該当セッションを upsert する。
   * createdAt は初回作成時のみ設定し、既存セッション更新時は変更しない。
   * coach_current_session_id を localStorage に保存する。
   */
  const saveCurrentSession = (
    sessionId: string,
    messages: Message[]
  ): void => {
    if (typeof window === "undefined") return;

    const sessions = readSessions();
    const existingIndex = sessions.findIndex((s) => s.id === sessionId);

    // image フィールドを除去してから localStorage に書き込む（ADR-002: content: string 不変条件）
    const persistedMessages = messages.map(({ role, content }) => ({ role, content }));

    if (existingIndex >= 0) {
      // 既存セッションの更新：createdAt は変更しない
      sessions[existingIndex] = {
        ...sessions[existingIndex],
        messages: persistedMessages,
      };
    } else {
      // 新規セッションの作成：createdAt を設定
      sessions.push({
        id: sessionId,
        createdAt: Date.now(),
        messages: persistedMessages,
      });
    }

    writeSessions(sessions);

    try {
      localStorage.setItem(CURRENT_ID_KEY, sessionId);
    } catch {
      // サイレント失敗
    }
  };

  /**
   * archiveCurrentSession: 現在のセッションを過去一覧に格上げする。
   * messages.length === 0 の場合は格上げしない（coach_current_session_id のみ削除）。
   * 過去セッション数が 3 を超える場合は createdAt が最小のセッションを削除する。
   */
  const archiveCurrentSession = (
    sessionId: string | null,
    messages: Message[]
  ): void => {
    if (typeof window === "undefined") return;

    // coach_current_session_id を削除
    try {
      localStorage.removeItem(CURRENT_ID_KEY);
    } catch {
      // サイレント失敗
    }

    if (messages.length === 0 || sessionId === null) {
      // 空セッションまたは sessionId が null の場合は格上げしない
      return;
    }

    const sessions = readSessions();
    const existingIndex = sessions.findIndex((s) => s.id === sessionId);

    // image フィールドを除去してから localStorage に書き込む（ADR-002: content: string 不変条件）
    const persistedMessages = messages.map(({ role, content }) => ({ role, content }));

    if (existingIndex >= 0) {
      // 既存セッションを更新（messages を最新化、createdAt は保持）
      sessions[existingIndex] = {
        ...sessions[existingIndex],
        messages: persistedMessages,
      };
    } else {
      // 新規として追加
      sessions.push({
        id: sessionId,
        createdAt: Date.now(),
        messages: persistedMessages,
      });
    }

    // Eviction: messages.length > 0 のセッションが 3 件を超える場合、createdAt 最小を削除
    const nonEmptySessions = sessions.filter((s) => s.messages.length > 0);
    if (nonEmptySessions.length > 3) {
      const oldestCreatedAt = Math.min(...nonEmptySessions.map((s) => s.createdAt));
      const oldestIndex = sessions.findIndex(
        (s) => s.createdAt === oldestCreatedAt && s.messages.length > 0
      );
      if (oldestIndex >= 0) {
        sessions.splice(oldestIndex, 1);
      }
    }

    writeSessions(sessions);
    setPastSessions(computePastSessions(sessions));
  };

  return {
    pastSessions,
    initialSessionData: initialSessionDataRef.current,
    saveCurrentSession,
    archiveCurrentSession,
  };
}

export function clearSessionStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSIONS_KEY);
    localStorage.removeItem(CURRENT_ID_KEY);
  } catch {
    // サイレント失敗
  }
}
