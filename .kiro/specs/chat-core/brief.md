# Brief: chat-core

## Problem

中学生がチャット形式でAIにヒントをもらいながら問題を解けるようにしたい。AIに答えを直接聞いても教えないコーチング動作が必要。テキストのみの画面ではAIの返答が読みにくく、数式・箇条書きなどを使った説明ができない。

## Current State

auth スペック完了後、`/chat` のシェルページが存在するが中身は空。Gemini API との接続なし。

## Desired Outcome

- テキスト入力でメッセージを送信できる（Enter送信 / Shift+Enter改行）
- AIがGemini 2.0 Flashでコーチング形式で返答する
- AIの返答がストリーミングでリアルタイム表示される
- AIの返答がMarkdownレンダリングされる（太字・箇条書き・コードブロックなど）
- 送信後に空のAIメッセージバブルが表示され、そこにテキストが流れ込む形式
- マルチターン（複数回のやり取り）ができる
- Geminiのレート制限エラー時に親切なメッセージが表示される
- ストリーミング中は入力欄・送信ボタンが disabled になる

## Approach

`/api/chat` Route Handler で Gemini API を呼び出し、`ReadableStream` でクライアントにストリーミング。フロントエンドは `fetch` + `ReadableStream` で受信。システムプロンプトは `lib/system-prompt.ts` に定数として管理。`react-markdown` でAI返答をレンダリング。

## Scope

- **In**: チャット画面UI（メッセージバブル、入力欄、送信ボタン）、`/api/chat` Route Handler、Gemini 2.0 Flash 呼び出し、ストリーミング実装、Markdownレンダリング、システムプロンプト（`lib/system-prompt.ts`）、エラーハンドリング（レート制限など）、ストリーミング中のUI制御（disabled状態）
- **Out**: localStorageへの保存（session-history が担当）、セッション切り替え・ドロワー（session-history が担当）、認証（auth が担当）

## Boundary Candidates

- メッセージの型定義（`Message: { role: 'user' | 'assistant', content: string }`）
- `useChat` カスタムフック（チャット状態・送信ロジック）
- `ChatMessage` コンポーネント（メッセージバブル + Markdownレンダリング）
- `ChatInput` コンポーネント（テキストエリア・送信ボタン）
- `/api/chat` Route Handler
- `lib/system-prompt.ts`

## Out of Boundary

- セッションの保存・復元（session-history が担当）
- ドロワーUI（session-history が担当）
- 「新しい会話」ボタンのロジック（session-history が担当）

## Upstream / Downstream

- **Upstream**: auth（認証済みユーザーのみがアクセス可能）
- **Downstream**: session-history（`Message[]` 型と `useChat` フックのインターフェースを利用）

## Existing Spec Touchpoints

- **Extends**: auth（`/chat` シェルページに実装を追加）
- **Adjacent**: session-history（`Message` 型の共有インターフェースを定義する）

## Constraints

- AIプロバイダー: Google Gemini 2.0 Flash（`@google/generative-ai` パッケージ）
- ストリーミング: Route Handler + ReadableStream（Vercel Edge Function 不使用）
- Markdownレンダリング: `react-markdown`
- `GEMINI_API_KEY` 環境変数が必要
- AIは答えを直接教えない（システムプロンプトで制御）
