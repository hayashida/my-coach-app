# Research Log: session-history

## Discovery Scope

- **Feature type**: Extension（既存 `chat-core` スペックへの追加）
- **Discovery process**: Light（統合焦点型）
- **Date**: 2026-06-28

## Key Findings

### 1. @base-ui/react の利用状況

- `@base-ui/react ^1.6.0` が既にインストール済み
- `@radix-ui/*` は使われていない（shadcn/ui の Sheet は未インストール）
- `src/components/ui/button.tsx` が `@base-ui/react/button` ベースで存在
- **結論**: ドロワーUIは `@base-ui/react` の Dialog コンポーネントをサイドパネルとしてスタイリングして実装する

### 2. useChat の現在のインターフェース

```typescript
// 現在のシグネチャ（変更前）
export interface UseChatReturn {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
}
```

- ストリーミング完了コールバックなし
- メッセージリセット関数なし
- 初期メッセージオプションなし

**結論**: `initialMessages` / `onStreamComplete` / `clearMessages` を後方互換で追加する

### 3. localStorage スコープ設計

- ADR-002: ユーザーIDでスコープしない（別デバイス使用前提）
- ADR-001: `coach_current_session_id`（独立キー）+ `coach_sessions`（配列）の2キー構造
- **リスク**: JSON パース失敗時に画面が壊れる → try-catch でフォールバック

### 4. Stale Closure 問題

`currentSessionId` state は `setCurrentSessionId` 呼び出し後も旧値を保持するため、`onStreamComplete` クロージャが null を参照してしまう。
**対策**: `currentSessionIdRef = useRef()` を page に持ち、`handleSendMessage` 内で ref を即時更新する（`use-chat.ts` の `messagesRef` パターンと同一）。

### 5. チャット画面の現在の構造

- `src/app/chat/page.tsx`: `useChat` + `ChatMessage` + `ChatInput` + `LogoutButton` のみ
- セッション管理なし、ドロワーなし
- auth はミドルウェア経由のため page 側での `useSession` 呼び出しは不要

## Design Decisions

### Session type 配置

`src/types/session.ts` を新規作成。`Message` 型を `chat-core` の契約として import する。

### Eviction ロジックの境界

Eviction ロジックは `useSessionStorage.archiveCurrentSession` が完全に所有する。page は「新しい会話」ボタン押下時に `archiveCurrentSession(sessionId, messages)` を呼ぶだけ。

### 「新しい会話」ボタンの disabled 条件

- `isStreaming === true`: AIが応答中（ADR-003）
- `messages.length === 0`: すでに空の会話（ADR-003）
- **除外**: 読み取り専用モード中 → 要件に明示なし、UX上も現在のセッションをアーカイブして新規開始は妥当

### @base-ui/react Dialog のドロワースタイリング

`Dialog.Popup` を `fixed left-0 top-0 h-full w-64 bg-white shadow-xl` で左サイドパネルとしてスタイリング。Tailwind CSS で実装。

## Rejected Alternatives

- **shadcn/ui Sheet**: 未インストール。@base-ui/react で代替可能なため採用しない
- **uuid ライブラリ**: `crypto.randomUUID()` がブラウザネイティブで利用可能なため不要
- **useEffect で onStreamComplete 検出**: `isStreaming` の変化を監視する useEffect は二重発火リスクがあるため、useChat に明示的コールバックを追加する方が安全
