"use client";

import { useRef, useState } from "react";
import { compressImage, CompressedImage } from "@/lib/image-compression";

interface ChatInputProps {
  onSubmit: (text: string) => void;
  onImageSubmit: (image: CompressedImage) => void;
  disabled: boolean;
}

type ChatInputState =
  | { mode: "text" }
  | { mode: "preview"; image: CompressedImage };

export function ChatInput({ onSubmit, onImageSubmit, disabled }: ChatInputProps) {
  const [text, setText] = useState("");
  const [state, setState] = useState<ChatInputState>({ mode: "text" });
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText("");
    textareaRef.current?.focus();
  };

  const handleImageSubmit = () => {
    if (state.mode !== "preview") return;
    onImageSubmit(state.image);
    setState({ mode: "text" });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  const handlePhotoButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // MIME バリデーション（要件 1.6 / 6.2）
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      e.target.value = "";
      return;
    }

    setError(null);
    try {
      const compressed = await compressImage(file);
      setState({ mode: "preview", image: compressed });
    } catch {
      setError("画像の圧縮に失敗しました");
    }
    // 競合防止のためリセット
    e.target.value = "";
  };

  const handleCancel = () => {
    setState({ mode: "text" });
    setError(null);
  };

  // ── プレビューモード ───────────────────────────────────────────────────
  if (state.mode === "preview") {
    return (
      <div className="flex gap-2 p-4 border-t items-center">
        <div className="flex-1">
          <img
            src={`data:image/jpeg;base64,${state.image.data}`}
            alt="プレビュー"
            className="h-16 w-16 object-cover rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).alt = "画像を表示できません";
            }}
          />
        </div>
        <button
          onClick={handleCancel}
          className="rounded-lg border px-4 py-2 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          onClick={handleImageSubmit}
          disabled={disabled}
          className="rounded-lg bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
        >
          送信
        </button>
      </div>
    );
  }

  // ── テキストモード ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      {error && (
        <p className="px-4 pt-2 text-sm text-red-500">{error}</p>
      )}
      <div className="flex gap-2 p-4 border-t">
        {/* 非表示ファイルピッカー */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border px-3 py-2 focus:outline-none disabled:opacity-50"
          placeholder="メッセージを入力..."
        />
        <button
          onClick={handlePhotoButtonClick}
          disabled={disabled}
          aria-label="写真を選択"
          className="rounded-lg border px-4 py-2 disabled:opacity-50"
        >
          写真
        </button>
        <button
          onClick={handleTextSubmit}
          disabled={disabled}
          className="rounded-lg bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
        >
          送信
        </button>
      </div>
    </div>
  );
}
