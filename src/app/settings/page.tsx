"use client";

import Link from "next/link";
import { useState } from "react";
import { useGradeLevel } from "@/hooks/use-grade-level";
import type { GradeLevel } from "@/types/grade-level";

const GRADE_LEVEL_OPTIONS: { value: GradeLevel; label: string }[] = [
  { value: "junior_high", label: "中学生" },
  { value: "high_school", label: "高校生" },
];

function gradeLevelLabel(level: GradeLevel): string {
  return GRADE_LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? level;
}

export default function SettingsPage() {
  const { gradeLevel, setGradeLevel } = useGradeLevel();
  // 保存前の選択値（保存済み値とは独立して保持する）。マウント時の現在値で初期化する。
  const [selected, setSelected] = useState<GradeLevel>(gradeLevel);

  const handleSave = () => {
    setGradeLevel(selected);
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-lg font-semibold">学年レベル設定</h1>
        <Link
          href="/chat"
          className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          チャットに戻る
        </Link>
      </header>

      <main className="flex-1 p-4 space-y-6">
        <p className="text-sm text-gray-600">
          現在の学年レベル:{" "}
          <span data-testid="current-grade-level" className="font-semibold">
            {gradeLevelLabel(gradeLevel)}
          </span>
        </p>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-gray-700">
            学年レベルを選択
          </legend>
          {GRADE_LEVEL_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 rounded-md p-2 hover:bg-gray-100"
            >
              <input
                type="radio"
                name="gradeLevel"
                value={option.value}
                checked={selected === option.value}
                onChange={() => setSelected(option.value)}
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          保存
        </button>
      </main>
    </div>
  );
}
