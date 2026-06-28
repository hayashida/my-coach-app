# Research & Design Decisions

---
**Feature**: `chat-core`
**Discovery Scope**: Complex Integration（Gemini API ストリーミング + React UI + カスタムフック）
**Key Findings**:
- `@google/generative-ai` は2025年8月31日廃止済み。`@google/genai` v2.10.0 に移行必須
- Gemini SDK は Node.js API 依存のため Edge Runtime 不可
- react-markdown v10 の標準 `Markdown` コンポーネントは `'use client'` 必須

---

## Research Log

### @google/genai vs @google/generative-ai の選択

- **Context**: Gemini API クライアントライブラリの選択
- **Sources Consulted**: npm registry, Google Gen AI JS SDK GitHub
- **Findings**:
  - `@google/generative-ai` は非推奨（`@google/genai` v2.x を使用するよう README に記載）
  - `@google/genai` 2.10.0 が最新安定版（2025年6月時点）
  - マルチターン: `ai.chats.create({ model, history, config })` + `chat.sendMessageStream({ message })`
  - system instruction は `config.systemInstruction` に設定
  - history の role は `"user"` / `"model"`（`"assistant"` ではない）
- **Implications**: インストールは `@google/genai`。Route Handler 内で `Message.role: "assistant"` → `"model"` の変換が必要

### Next.js App Router ストリーミング Route Handler

- **Context**: Gemini のストリーミングレスポンスをクライアントに渡す方法
- **Sources Consulted**: Next.js ドキュメント（Streaming Guides）、DEV Community記事
- **Findings**:
  - `new Response(new ReadableStream(...), { headers: { "Content-Type": "text/plain; charset=utf-8" } })` パターンで十分
  - Vercel AI SDK の `StreamingTextResponse` は不要（オーバースペック）
  - Edge Runtime は Gemini SDK が Node.js API に依存するため不可（Node.js Runtime デフォルト使用）
  - `export const runtime = "edge"` は設定しない
- **Implications**: シンプルな `Response(ReadableStream)` パターンを採用。Vercel AI SDK 依存なし

### react-markdown v10 の制約

- **Context**: AI 返答の Markdown レンダリング実装
- **Sources Consulted**: react-markdown GitHub (remarkjs/react-markdown)
- **Findings**:
  - v10.1.0 が最新（2025年3月）
  - 標準 `Markdown` コンポーネントは `'use client'` 環境が必要
  - `remarkGfm` プラグインで GFM（GitHub Flavored Markdown: テーブル・取り消し線等）が有効
  - `MarkdownAsync` は Server Component で使用可能だが、ストリーミング更新には不向き
- **Implications**: `ChatMessage` コンポーネントに `'use client'` が必要。`useChat` フックも同様

### フロントエンドでのストリーミング受信

- **Context**: Route Handler のストリーミングレスポンスを React state に流し込む方法
- **Sources Consulted**: Web Streams API MDN、Next.js Streaming ガイド
- **Findings**:
  - `response.body.getReader()` + `TextDecoder` + `while (true) { reader.read() }` パターン
  - `decoder.decode(value, { stream: true })` でマルチバイト文字の途中切れを防ぐ
  - ストリーミング中に React state を更新する場合、最後の assistant メッセージを不変更新でアップデート
- **Implications**: `useChat` フックに実装。`useCallback` で安定した参照を維持

---

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Vercel AI SDK `useChat` | AI SDK の組み込みフック | 実装が速い | 大きな依存、session-history との統合が難しい | 採用しない |
| カスタム `useChat` + fetch（採用） | カスタムフック + Web Streams | 依存なし、インターフェースを完全制御 | 実装コスト（小） | session-history との統合が明確 |
| Server-Sent Events (SSE) | EventSource API | ブラウザの組み込みサポート | テキスト形式に制限なし、だが追加の Route 設計が必要 | `text/plain` ストリームで十分 |

---

## Design Decisions

### Decision: Vercel AI SDK を使わないカスタムフックの採用

- **Context**: ストリーミング状態管理をどう実装するか
- **Alternatives Considered**:
  1. Vercel AI SDK `useChat` — 簡単だがブラックボックス、session-history がフックのインターフェースに依存するため不透明な実装は避けたい
  2. カスタム `useChat` + `fetch` + `ReadableStream`（採用）
- **Selected Approach**: カスタムフック
- **Rationale**: session-history スペックが `messages` や `sendMessage` を拡張・参照する必要があるため、公開インターフェースを完全に制御できるカスタムフックが適切。実装コストも少ない（約50行）
- **Trade-offs**: 初期実装コストは若干高いが、依存が減り将来の拡張性が高まる

### Decision: Message 型を src/types/message.ts に定義

- **Context**: session-history スペックが同じ型を使用する
- **Selected Approach**: `src/types/message.ts` に独立した型ファイルを作成
- **Rationale**: 型定義がアプリの任意の場所からインポートできる。session-history が `import { Message } from "@/types/message"` で参照可能
- **Trade-offs**: 型ファイルの変更は両スペックの再検証が必要（Revalidation Trigger に明記）

### Decision: Gemini history はステートレス（リクエストごとに送信）

- **Context**: マルチターン会話の実装方法
- **Alternatives Considered**:
  1. サーバー側でセッション（Conversation オブジェクト）を維持する
  2. クライアントが全履歴をリクエストに含める（採用）
- **Selected Approach**: クライアントが全 `messages` を `history` としてリクエストに含める
- **Rationale**: 2名の中学生ユーザー向けの小規模アプリ。サーバー側セッション管理は不要な複雑性
- **Trade-offs**: 会話が長くなるにつれリクエストサイズが増加するが、Gemini 2.0 Flash のコンテキストウィンドウ（1Mトークン）は十分

---

## Risks & Mitigations

- `GEMINI_API_KEY` 未設定 → Route Handler が 500 → `.env.local.example` に記載、起動時エラーを明確にする
- Gemini レート制限（無料枠: 15 req/min）→ エラーハンドリングとユーザー向けメッセージで対応
- ストリーミング中の React state 更新が高頻度になりパフォーマンス低下 → 小規模アプリ（2ユーザー）のため実用上問題なし
- react-markdown v10 が Next.js 16 / React 19 と非互換の可能性 → インストール後に `npm run build` で即時確認

---

## References

- [@google/genai npm](https://www.npmjs.com/package/@google/genai)
- [Google Gen AI JS SDK ドキュメント](https://googleapis.github.io/js-genai/release_docs/index.html)
- [Next.js App Router Streaming](https://nextjs.org/docs/app/guides/streaming)
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown)
- [Web Streams API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
