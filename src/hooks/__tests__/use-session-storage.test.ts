/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useSessionStorage } from "../use-session-storage";
import type { Session } from "@/types/session";
import type { Message } from "@/types/message";

// localStorage のモックヘルパー
const SESSIONS_KEY = "coach_sessions";
const CURRENT_ID_KEY = "coach_current_session_id";

function setLocalStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getLocalStorageRaw(key: string): string | null {
  return localStorage.getItem(key);
}

function makeSession(
  id: string,
  createdAt: number,
  messages: Message[]
): Session {
  return { id, createdAt, messages };
}

const MSG_USER: Message = { role: "user", content: "こんにちは" };
const MSG_ASSISTANT: Message = { role: "assistant", content: "返答" };

beforeEach(() => {
  localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// initialSessionData
// ─────────────────────────────────────────────────────────────────────────────

describe("initialSessionData", () => {
  it("localStorage に currentId も sessions もない場合は null を返す（要件1.2）", () => {
    const { result } = renderHook(() => useSessionStorage());
    expect(result.current.initialSessionData).toBeNull();
  });

  it("currentId が存在するが sessions に該当セッションがない場合は null を返す（不整合）", () => {
    localStorage.setItem(CURRENT_ID_KEY, "non-existent-id");
    setLocalStorage(SESSIONS_KEY, [
      makeSession("other-id", 1000, [MSG_USER]),
    ]);

    const { result } = renderHook(() => useSessionStorage());
    expect(result.current.initialSessionData).toBeNull();
  });

  it("currentId と sessions に一致するセッションがある場合、sessionId と messages を返す（要件1.2）", () => {
    const session = makeSession("session-1", 1000, [MSG_USER, MSG_ASSISTANT]);
    localStorage.setItem(CURRENT_ID_KEY, "session-1");
    setLocalStorage(SESSIONS_KEY, [session]);

    const { result } = renderHook(() => useSessionStorage());
    expect(result.current.initialSessionData).toEqual({
      sessionId: "session-1",
      messages: [MSG_USER, MSG_ASSISTANT],
    });
  });

  it("coach_sessions が JSON パース不可能な場合は null を返し例外を投げない", () => {
    localStorage.setItem(CURRENT_ID_KEY, "session-1");
    localStorage.setItem(SESSIONS_KEY, "INVALID_JSON{{{");

    expect(() => {
      renderHook(() => useSessionStorage());
    }).not.toThrow();

    const { result } = renderHook(() => useSessionStorage());
    expect(result.current.initialSessionData).toBeNull();
  });

  it("coach_sessions が配列でない JSON の場合は null を返す", () => {
    localStorage.setItem(CURRENT_ID_KEY, "session-1");
    setLocalStorage(SESSIONS_KEY, { not: "an array" });

    const { result } = renderHook(() => useSessionStorage());
    expect(result.current.initialSessionData).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// saveCurrentSession
// ─────────────────────────────────────────────────────────────────────────────

describe("saveCurrentSession", () => {
  it("新しいセッションを localStorage に保存し coach_current_session_id を設定する（要件1.1）", () => {
    const { result } = renderHook(() => useSessionStorage());

    act(() => {
      result.current.saveCurrentSession("session-1", [MSG_USER, MSG_ASSISTANT]);
    });

    expect(getLocalStorageRaw(CURRENT_ID_KEY)).toBe("session-1");
    const sessions: Session[] = JSON.parse(
      getLocalStorageRaw(SESSIONS_KEY) ?? "[]"
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("session-1");
    expect(sessions[0].messages).toEqual([MSG_USER, MSG_ASSISTANT]);
    expect(typeof sessions[0].createdAt).toBe("number");
  });

  it("既存セッションを更新する場合、createdAt を変更しない（upsert ロジック）", () => {
    const originalCreatedAt = 5000;
    setLocalStorage(SESSIONS_KEY, [
      makeSession("session-1", originalCreatedAt, [MSG_USER]),
    ]);
    localStorage.setItem(CURRENT_ID_KEY, "session-1");

    const { result } = renderHook(() => useSessionStorage());

    const newMessages: Message[] = [
      MSG_USER,
      MSG_ASSISTANT,
      { role: "user", content: "2回目" },
    ];

    act(() => {
      result.current.saveCurrentSession("session-1", newMessages);
    });

    const sessions: Session[] = JSON.parse(
      getLocalStorageRaw(SESSIONS_KEY) ?? "[]"
    );
    const saved = sessions.find((s) => s.id === "session-1");
    expect(saved?.createdAt).toBe(originalCreatedAt);
    expect(saved?.messages).toEqual(newMessages);
  });

  it("複数回呼び出してもセッション数が重複しない", () => {
    const { result } = renderHook(() => useSessionStorage());

    act(() => {
      result.current.saveCurrentSession("session-1", [MSG_USER]);
    });
    act(() => {
      result.current.saveCurrentSession("session-1", [MSG_USER, MSG_ASSISTANT]);
    });

    const sessions: Session[] = JSON.parse(
      getLocalStorageRaw(SESSIONS_KEY) ?? "[]"
    );
    expect(sessions.filter((s) => s.id === "session-1")).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// archiveCurrentSession
// ─────────────────────────────────────────────────────────────────────────────

describe("archiveCurrentSession", () => {
  it("messages.length === 0 の場合は格上げせず coach_current_session_id のみ削除する（要件3.4）", () => {
    const existingSession = makeSession("session-old", 1000, [MSG_USER]);
    setLocalStorage(SESSIONS_KEY, [existingSession]);
    localStorage.setItem(CURRENT_ID_KEY, "session-current");

    const { result } = renderHook(() => useSessionStorage());

    act(() => {
      result.current.archiveCurrentSession("session-current", []);
    });

    expect(getLocalStorageRaw(CURRENT_ID_KEY)).toBeNull();
    const sessions: Session[] = JSON.parse(
      getLocalStorageRaw(SESSIONS_KEY) ?? "[]"
    );
    // session-current は追加されていない
    expect(sessions.find((s) => s.id === "session-current")).toBeUndefined();
    // 既存の session-old は残っている
    expect(sessions.find((s) => s.id === "session-old")).toBeDefined();
  });

  it("messages.length > 0 の場合は格上げし coach_current_session_id を削除する（要件2.2）", () => {
    setLocalStorage(SESSIONS_KEY, []);
    localStorage.setItem(CURRENT_ID_KEY, "session-current");

    const { result } = renderHook(() => useSessionStorage());

    act(() => {
      result.current.archiveCurrentSession("session-current", [MSG_USER]);
    });

    expect(getLocalStorageRaw(CURRENT_ID_KEY)).toBeNull();
    const sessions: Session[] = JSON.parse(
      getLocalStorageRaw(SESSIONS_KEY) ?? "[]"
    );
    expect(sessions.find((s) => s.id === "session-current")).toBeDefined();
  });

  it("過去セッションが3件ある状態で格上げすると最古のセッションを削除する（要件2.3）", () => {
    const sessions: Session[] = [
      makeSession("s1", 1000, [MSG_USER]), // 最古
      makeSession("s2", 2000, [MSG_USER]),
      makeSession("s3", 3000, [MSG_USER]),
    ];
    setLocalStorage(SESSIONS_KEY, sessions);
    localStorage.setItem(CURRENT_ID_KEY, "s-new");

    const { result } = renderHook(() => useSessionStorage());

    act(() => {
      result.current.archiveCurrentSession("s-new", [MSG_USER]);
    });

    const stored: Session[] = JSON.parse(
      getLocalStorageRaw(SESSIONS_KEY) ?? "[]"
    );
    expect(stored).toHaveLength(3);
    // 最古 s1 が削除されている
    expect(stored.find((s) => s.id === "s1")).toBeUndefined();
    // 新しいセッションは存在する
    expect(stored.find((s) => s.id === "s-new")).toBeDefined();
  });

  it("sessionId が null の場合でも正常に動作する（messages > 0 は格上げしない = null sessionId は処理対象外）", () => {
    setLocalStorage(SESSIONS_KEY, []);

    const { result } = renderHook(() => useSessionStorage());

    expect(() => {
      act(() => {
        result.current.archiveCurrentSession(null, [MSG_USER]);
      });
    }).not.toThrow();

    expect(getLocalStorageRaw(CURRENT_ID_KEY)).toBeNull();
  });

  it("格上げ後に pastSessions が更新される", () => {
    setLocalStorage(SESSIONS_KEY, []);
    localStorage.setItem(CURRENT_ID_KEY, "session-current");

    const { result } = renderHook(() => useSessionStorage());

    act(() => {
      result.current.archiveCurrentSession("session-current", [MSG_USER]);
    });

    expect(result.current.pastSessions).toHaveLength(1);
    expect(result.current.pastSessions[0].id).toBe("session-current");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// pastSessions
// ─────────────────────────────────────────────────────────────────────────────

describe("pastSessions", () => {
  it("初期状態で localStorage に sessions がない場合は空配列を返す", () => {
    const { result } = renderHook(() => useSessionStorage());
    expect(result.current.pastSessions).toEqual([]);
  });

  it("messages.length > 0 のセッションのみを含む（要件3.4）", () => {
    const sessions: Session[] = [
      makeSession("s1", 1000, [MSG_USER]),
      makeSession("s2", 2000, []), // 空セッション
      makeSession("s3", 3000, [MSG_USER]),
    ];
    setLocalStorage(SESSIONS_KEY, sessions);

    const { result } = renderHook(() => useSessionStorage());

    expect(result.current.pastSessions.every((s) => s.messages.length > 0)).toBe(
      true
    );
    expect(result.current.pastSessions.find((s) => s.id === "s2")).toBeUndefined();
  });

  it("createdAt 降順で最大3件を返す（要件3.2）", () => {
    const sessions: Session[] = [
      makeSession("s1", 1000, [MSG_USER]),
      makeSession("s2", 3000, [MSG_USER]),
      makeSession("s3", 2000, [MSG_USER]),
      makeSession("s4", 4000, [MSG_USER]),
    ];
    setLocalStorage(SESSIONS_KEY, sessions);

    const { result } = renderHook(() => useSessionStorage());

    expect(result.current.pastSessions).toHaveLength(3);
    expect(result.current.pastSessions[0].id).toBe("s4"); // createdAt=4000
    expect(result.current.pastSessions[1].id).toBe("s2"); // createdAt=3000
    expect(result.current.pastSessions[2].id).toBe("s3"); // createdAt=2000
    // s1 (createdAt=1000) は除外される
    expect(result.current.pastSessions.find((s) => s.id === "s1")).toBeUndefined();
  });

  it("JSON パース失敗時は空配列を返し例外を投げない", () => {
    localStorage.setItem(SESSIONS_KEY, "INVALID_JSON");

    expect(() => {
      renderHook(() => useSessionStorage());
    }).not.toThrow();

    const { result } = renderHook(() => useSessionStorage());
    expect(result.current.pastSessions).toEqual([]);
  });
});
