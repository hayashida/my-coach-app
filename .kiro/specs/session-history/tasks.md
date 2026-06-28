# Implementation Plan

- [x] 1. Foundation: 共有型定義の整備

- [x] 1.1 Session 型を定義する
  - `src/types/session.ts` を新規作成し、`Session` 型（`id: string`, `createdAt: number`, `messages: Message[]`）を定義する
  - `Message` 型を `@/types/message` からインポートする
  - `npx tsc --noEmit` で型エラーなく通過する
  - _Requirements: 1.1, 2.2, 3.3_

- [x] 2. Core: コンポーネント・フックの並列実装

- [x] 2.1 (P) useSessionStorage フックを実装する
  - `src/hooks/use-session-storage.ts` を新規作成する
  - `saveCurrentSession(sessionId, messages)`: `coach_sessions` の該当セッションを upsert する（`createdAt` は**初回作成時のみ**設定し、既存セッション更新時は変更しない）。`coach_current_session_id` を localStorage に保存する
  - `archiveCurrentSession(sessionId, messages)`: `messages.length > 0` の場合のみ現在のセッションを過去一覧に格上げする。過去セッション数が 3 を超える場合は `createdAt` が最小のセッションを削除する。`coach_current_session_id` を localStorage から削除する
  - `archiveCurrentSession`: `messages.length === 0` のセッションはlocalStorageに格上げしない
  - `initialSessionData`: SSR 安全な同期初期化（`typeof window !== 'undefined'` ガード）。`coach_current_session_id` が指すセッションが `coach_sessions` に存在しない場合は `null` を返す。JSON.parse は try-catch で空配列にフォールバックする
  - `pastSessions` が常に `messages.length > 0` のセッション最大3件（`createdAt` 降順）を返す
  - `npm run build` でビルドが成功する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 3.2, 3.4_
  - _Boundary: useSessionStorage_

- [x] 2.2 (P) useChat フックを拡張する
  - `src/hooks/use-chat.ts` に `UseChatOptions`（`initialMessages?: Message[]`, `onStreamComplete?: (messages: Message[]) => void`）を追加する
  - `initialMessages` を `useState<Message[]>` の初期値として使用する
  - `onStreamComplete` はストリーミングが `error` なし（`error === null`）で完了した直後に最新の `messages` を引数に呼び出す
  - `clearMessages(): void` を return オブジェクトに追加する（`setMessages([])` と `messagesRef.current = []` を同時リセット）
  - 既存の `useChat()` 無引数呼び出しへの後方互換を維持する
  - `npm run build` でビルドが成功する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Boundary: useChat_

- [x] 2.3 (P) SessionListItem コンポーネントを実装する
  - `src/components/session/session-list-item.tsx` を新規作成する（`'use client'` 指定）
  - セッション内の最初のユーザーメッセージ（`role === "user"` の最初の要素）の `content` を最大30文字で表示する
  - 30文字超過時は末尾に `"..."` を付加する
  - 該当するユーザーメッセージが存在しない場合は `"（メッセージなし）"` を表示する
  - `npm run build` でビルドが成功する
  - _Requirements: 3.3_
  - _Boundary: SessionListItem_

- [x] 2.4 (P) ReadonlyBanner コンポーネントを実装する
  - `src/components/session/readonly-banner.tsx` を新規作成する（`'use client'` 指定）
  - 「過去の会話を表示中」ラベルと「現在の会話に戻る」ボタンを含む
  - `sticky top-0` で画面上部に固定表示する
  - `npm run build` でビルドが成功する
  - _Requirements: 4.3, 4.4_
  - _Boundary: ReadonlyBanner_

- [x] 2.5 SessionDrawer コンポーネントを実装する
  - `src/components/session/session-drawer.tsx` を新規作成する（`'use client'` 指定）
  - `@base-ui/react` の `Dialog.Root` / `Dialog.Portal` / `Dialog.Backdrop` / `Dialog.Popup` を使用してサイドドロワーを実装する
  - `Dialog.Popup` は `fixed left-0 top-0 h-full w-64 bg-white shadow-xl` で左サイドパネルとして表示する
  - セッション一覧の各行は `SessionListItem` に委譲する
  - `sessions.length === 0` の場合は「まだ保存済みの会話がありません」を表示する
  - `npm run build` でビルドが成功する
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Depends: 2.3_
  - _Boundary: SessionDrawer_

- [x] 3. Integration: チャットページへの統合

- [x] 3.1 セッション永続化をチャットページに配線する
  - `src/app/chat/page.tsx` で `useSessionStorage` の `initialSessionData` を取得し、`useChat({ initialMessages: initialSessionData?.messages ?? [] })` に渡す
  - `currentSessionIdRef`（useRef）と state の両方で現在のセッションIDを管理する（stale closure 対策）
  - `handleSendMessage` ラッパーを実装する: `currentSessionIdRef.current` が null の場合 `crypto.randomUUID()` で生成し ref を即時更新・state を非同期更新してから `sendMessage` を呼ぶ
  - `onStreamComplete` コールバックで `saveCurrentSession(currentSessionIdRef.current!, messages)` を呼び出す
  - 「新しい会話」ボタンのクリックで `archiveCurrentSession(currentSessionIdRef.current, messages)` を呼び、`clearMessages()` と `setCurrentSessionId(null)` / ref クリアを実行する
  - `npm run build` でビルドが成功する
  - _Requirements: 1.1, 1.2, 2.2, 2.3, 2.4, 2.5_
  - _Depends: 2.1, 2.2_

- [x] 3.2 UI統合（読み取り専用モード・ドロワー）をチャットページに実装する
  - `viewingSession: Session | null` state を追加する
  - 表示メッセージを `viewingSession ? viewingSession.messages : messages` で切り替える
  - ドロワートグルボタンを追加し `isDrawerOpen` state で `SessionDrawer` の開閉を制御する
  - `SessionDrawer` の `onSelectSession` で `viewingSession` に選択セッションをセットし、ドロワーを閉じる
  - `viewingSession !== null` の場合: `ReadonlyBanner` を表示し `ChatInput` を非表示にする
  - `ReadonlyBanner` の `onReturn` で `viewingSession` を `null` にリセットする
  - `npm run build` で `/chat` ルートがエラーなくビルドできる
  - _Requirements: 2.1, 3.1, 4.1, 4.2, 4.3, 4.4_
  - _Depends: 2.4, 2.5, 3.1_

- [x] 4. Validation: テストの実装

- [x] 4.1 (P) useSessionStorage の単体テストを書く
  - `saveCurrentSession` がメッセージを localStorage に保存し、既存セッションの `createdAt` を変更しない（要件1.1）
  - `archiveCurrentSession`: `messages.length === 0` のセッションは格上げされない（要件3.4）
  - `archiveCurrentSession` Eviction: 過去3件の状態で呼び出すと最古（`createdAt` 最小）が削除される（要件2.3）
  - `initialSessionData`: localStorage に既存セッションがある場合に正しく初期データが返される（要件1.2）
  - JSON.parse 失敗時に例外を投げず空データとして扱われる
  - `useSessionStorage` のソース内にログアウトイベント（`signOut` / NextAuth auth event）のリスナーが存在しないことを確認する（要件1.5 — 構造的検証）
  - テストケースがすべて pass する
  - _Requirements: 1.1, 1.2, 1.5, 2.3, 3.4_
  - _Boundary: useSessionStorage_

- [x] 4.2 (P) useChat 拡張の単体テストを書く
  - `initialMessages` 指定時に `messages` の初期値が指定値になる（要件1.2）
  - `onStreamComplete` がストリーミング完了後（エラーなし）に呼ばれる（要件1.1）
  - `onStreamComplete` が Gemini エラー発生時（401/429/500）に呼ばれない（要件1.3, 1.4）
  - `clearMessages` 呼び出し後に `messages` が空配列になる（要件2.2）
  - 既存のテストケース（空文字送信・401/429/500エラー・ストリーミング状態）が引き続き pass する
  - テストケースがすべて pass する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2_
  - _Boundary: useChat_

- [x] 4.3 (P) SessionListItem・SessionDrawer・ReadonlyBanner のコンポーネントテストを書く
  - `SessionListItem`: 最初のユーザーメッセージが30文字超過時に `"..."` が付加される（要件3.3）
  - `SessionListItem`: ユーザーメッセージが存在しない場合に「（メッセージなし）」を表示する
  - `SessionDrawer`: `sessions` が空配列の場合に空状態メッセージを表示する
  - `ReadonlyBanner`: 「現在の会話に戻る」ボタンクリックで `onReturn` が呼ばれる（要件4.4）
  - テストケースがすべて pass する
  - _Requirements: 3.3, 4.4_
  - _Boundary: SessionDrawer, SessionListItem, ReadonlyBanner_

- [x] 4.4 (P) チャットページの統合テストを書く
  - ドロワーでセッションを選択した後、読み取り専用モードに切り替わり、選択したセッションのメッセージが表示される（要件4.1）
  - 読み取り専用モード中: `ChatInput` が非表示、`ReadonlyBanner` が表示される（要件4.2, 4.3）
  - 「新しい会話」ボタン: `isStreaming=true` の場合 disabled（要件2.4）
  - 「新しい会話」ボタン: `messages.length=0` の場合 disabled（要件2.5）
  - テストケースがすべて pass する
  - _Requirements: 2.4, 2.5, 4.1, 4.2, 4.3_
  - _Depends: 3.2_
  - _Boundary: chat/page.tsx_

## Implementation Notes
