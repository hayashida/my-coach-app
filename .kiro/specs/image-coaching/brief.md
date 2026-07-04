# Brief: image-coaching

## Problem

中学生が教科書や問題集をチャットアプリで活用しようとすると、テキストで問題を打ち込む必要があり手間がかかる。写真を撮るだけで即座にAIコーチに相談できれば、学習の敷居が大幅に下がる。

## Current State

現在の `/chat` ページはテキスト入力専用。`Message` 型は `content: string` のみ対応。Gemini APIルートも `{message: string, history: Message[]}` のJSON形式のみ受け付ける。`@google/genai` v2.10.0 は `inlineData` 経由で画像をネイティブサポートしており、SDKレベルでの対応は不要。

## Desired Outcome

ユーザーが `/chat` 画面で写真ボタンをタップ → カメラ撮影またはフォトライブラリから選択 → 写真がチャットバブルとして表示 → AIが写真内の問題を分析し、答えを直接教えずヒントと問いかけでコーチング → そのまま同じ会話でテキスト追加質問も可能。

## Approach

**チャット統合型**: 既存の `/chat` ページに写真ボタンを追加し、画像メッセージをテキストメッセージと同じ会話フローで扱う。`<input type="file" accept="image/*">` でカメラ/アルバム両対応（モバイルブラウザ標準挙動）。クライアント側でCanvas APIにより最大1024px・JPEG 70%品質に圧縮してからbase64送信。localStorage永続化時は画像本体は保存せず `[写真]` プレースホルダーで代替（容量問題回避）。

## Scope

- **In**:
  - チャット入力欄への写真ボタン追加（カメラ/アルバム選択）
  - 選択後の写真プレビュー表示（送信前確認）
  - 画像メッセージバブル（チャット内で写真を表示）
  - クライアント側画像圧縮（Canvas API: 最大1024px / JPEG 0.7）
  - `Message` 型拡張（`content: string | ImageContent`）
  - `useChat` フック拡張（画像送信対応）
  - `/api/chat` ルート拡張（マルチモーダル対応、Gemini `inlineData` 利用）
  - 画像コーチング用システムプロンプト追加（写真内の問題を分析しヒント形式で返答）
  - 写真後のテキスト追加質問（同一会話内でのマルチターン継続）
- **Out**:
  - localStorage への画像バイナリ永続化（セッション復元時は `[写真]` プレースホルダーを表示）
  - 複数画像の同時送信
  - 画像アノテーション・トリミング機能
  - OCR専用モード（テキスト抽出のみ）
  - 動画・音声対応

## Boundary Candidates

- **写真入力UI**: チャット入力欄への追加ボタン、ファイルピッカー制御、プレビュー表示
- **画像圧縮処理**: Canvas APIを用いたクライアント側リサイズ・品質調整
- **型定義の拡張**: `Message`型・APIリクエスト型の変更（既存コードへの影響あり）
- **マルチモーダルAPIルート**: `inlineData`付きGemini呼び出し、履歴変換ロジック拡張

## Out of Boundary

- セッション履歴の永続化・復元ロジック（session-historyスペックの責務）
- Google OAuth・認証保護（authスペックの責務）
- チャットのストリーミング基盤そのもの（chat-coreの責務、ただし拡張は本スペックが行う）

## Upstream / Downstream

- **Upstream**: auth（認証済みセッション前提）、chat-core（`Message`型・`useChat`・`/api/chat`を拡張）、session-history（`Message`型を参照しているため型変更の影響を受ける）
- **Downstream**: 将来的な複数画像対応・数式OCR連携など視覚情報活用拡張の起点となる

## Existing Spec Touchpoints

- **Extends**: chat-core（`Message`型・`useChat`フック・`/api/chat`ルートを拡張）、session-history（`Message`型変更に伴う参照箇所の更新）
- **Adjacent**: session-history（localStorageシリアライズ時の`ImageContent`処理を追加する必要あり）

## Constraints

- Gemini 2.0 Flash 無料枠内で運用（高解像度画像は圧縮で対応）
- Vercel Hobby プランのリクエストサイズ制限（デフォルト4.5MB、圧縮後~200KBで十分余裕あり）
- モバイルブラウザ（iOS Safari / Android Chrome）での動作を主眼に置く
- localStorage は1オリジン5〜10MB制限のため画像バイナリは永続化しない
