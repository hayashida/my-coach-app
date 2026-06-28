'use client';

interface ReadonlyBannerProps {
  onReturn: () => void;
}

export function ReadonlyBanner({ onReturn }: ReadonlyBannerProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-2">
      <span className="text-sm text-amber-800 font-medium">過去の会話を表示中</span>
      <button
        onClick={onReturn}
        className="text-sm text-amber-700 underline hover:text-amber-900"
      >
        現在の会話に戻る
      </button>
    </div>
  );
}
