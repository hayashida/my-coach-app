# Implementation Plan

- [ ] 1. Foundation: パッケージ・環境変数・共有型の整備

- [x] 1.1 依存パッケージをインストールし環境変数テンプレートと jest 設定を整備する
  - `@google/genai`、`react-markdown`、`remark-gfm` をインストールする（`npm install @google/genai react-markdown remark-gfm`）
  - `jest-environment-jsdom`、`@testing-library/react`、`@testing-library/user-event` を dev 依存としてインストールする（フェーズ4のReactコンポーネントテスト用）
  - 既存の `jest.config.ts` を確認し、React テスト用 DOM 環境が設定されているかを確認する。未設定の場合は `next/jest` を使った jest 設定を追加する
  - `.env.local.example` に `GEMINI_API_KEY=your-gemini-api-key` を追加する
  - `npm run build` が成功することを確認する
  - _Requirements: 3.1, 3.2_

- [x] 1.2 Message 型定義とコーチング用システムプロンプト定数を実装する
  - `src/types/message.ts` に `Message` 型（`role: "user" | "assistant"`, `content: string`）を作成する（session-history スペックとの共有契約）
  - `src/lib/system-prompt.ts` に AI コーチングの動作ルール（答えを直接教えない、ヒントと問いかけで思考を促す、中学生向けの言葉を使う、Markdown 形式で返答する）を定義した `SYSTEM_PROMPT` 定数を実装する
  - `npx tsc --noEmit` が成功することを確認する
  - _Requirements: 2.3, 3.2_

- [ ] 2. Core: バックエンド・フロントエンドコンポーネントの並列実装

- [x] 2.1 (P) /api/chat Route Handler を実装する
  - `src/app/api/chat/route.ts` に POST エンドポイントを作成する（Node.js Runtime のみ対応、`export const runtime = "edge"` は設定しない）
  - `auth()` でセッションを確認し、未認証の場合は `{ error: "Unauthorized" }` と HTTP 401 を返す（`/api` パスは Middleware の除外対象のため、Route Handler 内での認証確認が必須）
  - リクエストボディから `{ message: string, history: Message[] }` を取得し、`history` の `role` を `"assistant" → "model"` に変換して Gemini の history 形式にマッピングする
  - `@google/genai` で `ai.chats.create({ model: "gemini-2.0-flash", history: geminiHistory, config: { systemInstruction: SYSTEM_PROMPT } })` を作成し、`chat.sendMessageStream({ message })` でストリーミング送信する
  - Gemini の AsyncGenerator を `ReadableStream` に変換し、`Content-Type: text/plain; charset=utf-8` のレスポンスを返す
  - Gemini が 429 系エラーを返した場合は `{ error: "rate_limit" }` と HTTP 429 を返す。その他のエラーは HTTP 500 を返す
  - `npm run build` でビルドが成功する
  - _Requirements: 3.1, 3.2, 3.3, 6.1, 6.2, 6.3_
  - _Boundary: ChatRoute_

- [x] 2.2 (P) useChat カスタムフックを実装する
  - `src/hooks/use-chat.ts` に `useChat` フックを実装する（`messages: Message[]`, `isStreaming: boolean`, `error: string | null`, `sendMessage: (text: string) => Promise<void>` を返す）
  - `sendMessage` の動作: ①テキストが空なら即リターン（要件 1.5） ②呼び出し時点の `messages` を `historySnapshot` に保存する（history 二重送信防止） ③`messages` に `{ role: "user", content: text }` を追加 ④`isStreaming = true`, `error = null` ⑤`messages` に `{ role: "assistant", content: "" }` を追加 ⑥`POST /api/chat` を `{ message: text, history: historySnapshot }` で呼び出す ⑦`response.body` を `ReadableStream` として読み取り、チャンクを最後の assistant メッセージの `content` に追記 ⑧完了後 `isStreaming = false`
  - HTTP エラーレスポンス（401/429/500）受信時は `error` に適切な日本語メッセージを設定し `isStreaming = false` にする（要件 6.1, 6.2, 6.3）
  - `npm run build` でビルドが成功する
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 3.1, 3.3, 5.1, 5.2, 6.1, 6.2, 6.3_
  - _Boundary: UseChat_

- [x] 2.3 (P) ChatMessage コンポーネントを実装する
  - `src/components/chat/chat-message.tsx` に `ChatMessage` コンポーネントを実装する（`'use client'` 指定必須：react-markdown が Client Component を要求）
  - `message.role === "user"` と `"assistant"` でバブルのスタイルを切り替える
  - AI メッセージ（`role: "assistant"`）は `react-markdown` + `remarkGfm` プラグインで Markdown レンダリングする
  - ユーザーメッセージ（`role: "user"`）はプレーンテキストとして表示する（XSS 対策）
  - `npm run build` でコンポーネントがエラーなくビルドできる
  - _Requirements: 2.1, 4.1_
  - _Boundary: ChatMessage_

- [x] 2.4 (P) ChatInput コンポーネントを実装する
  - `src/components/chat/chat-input.tsx` に `ChatInput` コンポーネントを実装する（`'use client'` 指定）
  - `onSubmit: (text: string) => void` と `disabled: boolean` を prop として受け取る
  - テキストエリア（`textarea`）と送信ボタンを表示する
  - 送信ボタンのクリックで `onSubmit(text)` を呼び出す（要件 1.2）
  - Enter キー単独押下で `onSubmit(text)` を呼び出し、テキストエリアを空にする（要件 1.3）
  - Shift+Enter は改行とし、`onSubmit` を呼び出さない（要件 1.4）
  - `onSubmit` 呼び出し後にテキストエリアを空にし、フォーカスを textarea に戻す
  - `disabled` が `true` のとき textarea と送信ボタンを操作不能（`disabled` 属性）にする（要件 5.1）
  - `npm run build` でコンポーネントがエラーなくビルドできる
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1_
  - _Boundary: ChatInput_

- [ ] 3. Integration: チャットページへの統合

- [x] 3.1 チャットページにすべてのコンポーネントを統合する
  - `src/app/chat/page.tsx` のプレースホルダーを削除し、`useChat`・`ChatMessage`・`ChatInput`・`LogoutButton`（既存）を統合する
  - `useChat` の `messages` を `ChatMessage` のリストとして表示する
  - `useChat` の `sendMessage` を `ChatInput.onSubmit` に渡す
  - `useChat` の `isStreaming` を `ChatInput.disabled` に渡す
  - `useChat` の `error` が非 null の場合、エラーメッセージを UI に表示する
  - `npm run build` で `/chat` ルートがエラーなくビルドできる（ローカル環境で GEMINI_API_KEY を設定後、メッセージ送受信が動作可能）
  - _Requirements: 1.1, 2.1, 2.2, 3.3, 5.1, 5.2_
  - _Depends: 2.1, 2.2, 2.3, 2.4_

- [ ] 4. Validation: テストの実装

- [x] 4.1 (P) /api/chat Route Handler の統合テストを書く
  - 未認証リクエスト（セッションなし）→ HTTP 401 を返すことをテストする
  - Gemini SDK をモックして、認証済みリクエスト → `ReadableStream` を含むレスポンス（HTTP 200）が返ることをテストする
  - Gemini SDK がレート制限エラーを返した場合 → HTTP 429 を返すことをテストする
  - 3つのテストケースがすべて pass する
  - _Requirements: 3.1, 3.3, 6.1, 6.2_
  - _Boundary: ChatRoute_

- [x] 4.2 (P) useChat フックの単体テストを書く
  - `fetch` をモックして以下をテストする:
    - 空文字列の `sendMessage("")` → fetch が呼ばれない（要件 1.5）
    - fetch が HTTP 401 → `error` に適切なメッセージが設定され、`isStreaming` が `false` になる（要件 6.1, 6.3）
    - fetch が HTTP 429 → `error` に適切なメッセージが設定され、`isStreaming` が `false` になる（要件 6.1, 6.3）
    - fetch が HTTP 500 → `error` に適切なメッセージが設定され、`isStreaming` が `false` になる（要件 6.2, 6.3）
    - ストリーミング中は `isStreaming === true`、完了後は `isStreaming === false` になる（要件 5.1, 5.2）
  - テストケースがすべて pass する
  - _Requirements: 1.5, 5.1, 5.2, 6.1, 6.2, 6.3_
  - _Boundary: UseChat_

- [ ]* 4.3 (P) ChatInput のキーボード動作テストを書く
  - `@testing-library/react` と `@testing-library/user-event` を使用して以下をテストする:
    - テキスト入力後 Enter キー → `onSubmit` が呼ばれる（要件 1.3）
    - テキスト入力後 Shift+Enter → `onSubmit` が呼ばれない（要件 1.4）
  - テストケースがすべて pass する
  - _Requirements: 1.3, 1.4_
  - _Boundary: ChatInput_
