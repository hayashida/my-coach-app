import { useState } from "react";
import {
  DEFAULT_RESPONSE_LEVEL,
  isResponseLevel,
  type ResponseLevel,
} from "@/types/response-level";

const RESPONSE_LEVEL_KEY = "coach_response_level";

export interface UseResponseLevelReturn {
  responseLevel: ResponseLevel;
  setResponseLevel: (level: ResponseLevel) => void;
}

/**
 * localStorage から応答レベルを SSR 安全に同期読み込みする。
 * 未設定または不正な値の場合は DEFAULT_RESPONSE_LEVEL を返す。
 */
function readResponseLevel(): ResponseLevel {
  if (typeof window === "undefined") return DEFAULT_RESPONSE_LEVEL;
  try {
    const raw = localStorage.getItem(RESPONSE_LEVEL_KEY);
    return isResponseLevel(raw) ? raw : DEFAULT_RESPONSE_LEVEL;
  } catch {
    return DEFAULT_RESPONSE_LEVEL;
  }
}

/** 応答レベルを localStorage に書き込む。SSR 安全。書き込み失敗はサイレントキャッチ。 */
function writeResponseLevel(level: ResponseLevel): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RESPONSE_LEVEL_KEY, level);
  } catch {
    // 容量超過・プライベートモード等のエラーはサイレント失敗
  }
}

/**
 * 応答レベルを localStorage から SSR 安全に読み込み、変更を永続化するフック。
 * 保存の成否に関わらず in-memory 状態は選択値に即座に更新される（Req 4.2）。
 */
export function useResponseLevel(): UseResponseLevelReturn {
  const [responseLevel, setResponseLevelState] = useState<ResponseLevel>(() =>
    readResponseLevel()
  );

  const setResponseLevel = (level: ResponseLevel): void => {
    // in-memory 状態を先に更新してから永続化を試みる（Req 4.2: 保存失敗時も継続動作）
    setResponseLevelState(level);
    writeResponseLevel(level);
  };

  return {
    responseLevel,
    setResponseLevel,
  };
}
