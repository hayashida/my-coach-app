import { useState } from "react";
import {
  DEFAULT_GRADE_LEVEL,
  isGradeLevel,
  type GradeLevel,
} from "@/types/grade-level";

const GRADE_LEVEL_KEY = "coach_grade_level";

export interface UseGradeLevelReturn {
  gradeLevel: GradeLevel;
  setGradeLevel: (level: GradeLevel) => void;
}

/**
 * localStorage から学年レベルを SSR 安全に同期読み込みする。
 * 未設定または不正な値の場合は DEFAULT_GRADE_LEVEL を返す。
 */
function readGradeLevel(): GradeLevel {
  if (typeof window === "undefined") return DEFAULT_GRADE_LEVEL;
  try {
    const raw = localStorage.getItem(GRADE_LEVEL_KEY);
    return isGradeLevel(raw) ? raw : DEFAULT_GRADE_LEVEL;
  } catch {
    return DEFAULT_GRADE_LEVEL;
  }
}

/** 学年レベルを localStorage に書き込む。SSR 安全。書き込み失敗はサイレントキャッチ。 */
function writeGradeLevel(level: GradeLevel): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GRADE_LEVEL_KEY, level);
  } catch {
    // 容量超過・プライベートモード等のエラーはサイレント失敗
  }
}

/**
 * 学年レベルを localStorage から SSR 安全に読み込み、変更を永続化するフック。
 * 保存の成否に関わらず in-memory 状態は選択値に即座に更新される（Req 4.1）。
 */
export function useGradeLevel(): UseGradeLevelReturn {
  const [gradeLevel, setGradeLevelState] = useState<GradeLevel>(() =>
    readGradeLevel()
  );

  const setGradeLevel = (level: GradeLevel): void => {
    // in-memory 状態を先に更新してから永続化を試みる（Req 4.1: 保存失敗時も継続動作）
    setGradeLevelState(level);
    writeGradeLevel(level);
  };

  return {
    gradeLevel,
    setGradeLevel,
  };
}
