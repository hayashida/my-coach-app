# Implementation Plan

- [ ] 1. Foundation — 型定義と画像圧縮基盤
- [x] 1.1 `Message` 型に画像サポートのための型を追加
  - `MessageImage` 型（base64 データと MIME タイプのフィールド）を定義し、`Message` 型に `image?: MessageImage` フィールドを追加する
  - 型変更後に既存テスト（chat-input, use-chat, use-session-storage）がコンパイルエラーなく通ることを確認する
  - `Message.image` は in-memory のみで使用され、localStorage には保存されない（design.md の不変条件）
  - 既存の全テストが `tsc --noEmit` でエラーゼロで通る
  - _Requirements: 1.3, 2.1, 4.2, 5.1_

- [x] 1.2 `ImageCompression` ユーティリティを実装
  - Canvas API（`createImageBitmap` → canvas `drawImage` → `toBlob`）で入力画像を最大 1024px・JPEG 0.7 品質に圧縮して base64 文字列（プレフィックスなし）を返す `compressImage` 関数を実装する
  - MIME タイプが `image/*` 以外の場合は日本語エラーメッセージとともにエラーをスローする
  - 単体テスト（`@jest-environment jsdom`、Canvas API をモック）: 正常圧縮フローで `CompressedImage` が返ること・非画像ファイル入力時にエラーがスローされることを検証し、テストが PASS する
  - _Requirements: 1.3, 6.2_

- [ ] 2. Core — チャットコンポーネントの拡張
- [x] 2.1 (P) ChatInput に写真ボタンとプレビュー状態を追加
  - チャット入力欄に写真ボタン（カメラアイコン）を追加し、クリックで非表示ファイルピッカー（`accept="image/*"`）をトリガーする
  - ファイル選択後に `compressImage` を呼び出し、プレビュー状態（サムネイル・確定ボタン・キャンセルボタン）へ遷移する
  - 確定操作で `onImageSubmit(compressed)` コールバックを呼び出す
  - キャンセル操作で通常の入力状態に戻り、選択した画像は破棄される
  - `disabled=true` のとき写真ボタンおよび確定ボタンが無効化される
  - 非画像ファイル選択時にエラーメッセージを表示し、プレビュー遷移しない
  - プレビュー中の `<img>` 読み込み失敗時に代替テキストを表示する
  - `ChatInputProps` に `onImageSubmit: (image: CompressedImage) => void` が追加されて型チェックが通る
  - _Boundary: ChatInput_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.2, 6.3_

- [ ] 2.2 (P) ChatMessage に画像メッセージ表示を追加
  - `message.image` が存在する場合、右寄せバブル内に `<img>` タグで写真を表示する（`src` は `data:{mimeType};base64,{data}` 形式）
  - `message.image === undefined` の場合は既存のテキストバブルを維持する（`[写真]` プレースホルダーのセッション復元時を含む）
  - 画像バブルがテキストバブルと同じ最大幅制約（最大 80%）で右寄せ表示される
  - _Boundary: ChatMessage_
  - _Requirements: 2.1, 2.2, 5.1_

- [ ] 2.3 (P) useChat フックに `sendImage` 関数を追加
  - `sendImage(image: CompressedImage): Promise<void>` を実装し、`UseChatReturn` インターフェースに追加する
  - 呼び出し時にユーザーメッセージ `{role: "user", content: "[写真]", image: {data, mimeType}}` を messages に追加する
  - `/api/chat` に `{image: {data, mimeType}, history: historySnapshot}` を POST し、ストリーミング返答を既存の `sendMessage` と同様に受信・表示する
  - ストリーミング完了後に `onStreamComplete(messages)` が呼ばれる
  - API エラー（401/429/500）発生時に既存と同等のエラーメッセージを `error` state にセットする
  - `UseChatReturn` に `sendImage` が追加された状態で型チェックが通る
  - _Boundary: useChat_
  - _Requirements: 3.1, 3.3, 4.1, 4.2, 6.1_

- [ ] 3. Integration — API ルートと永続化の拡張
- [ ] 3.1 (P) `/api/chat` ルートをマルチモーダルに対応し、画像コーチング指示を追加
  - `SYSTEM_PROMPT` に写真内の問題を分析してヒント形式でコーチングする指示を追記する（既存のテキストコーチング指示を維持）
  - `/api/chat` のリクエストボディに `image?: {data: string; mimeType: string}` を追加し、受け付けられる形式を拡張する
  - Gemini 履歴変換を拡張し、`m.image` がある場合は `inlineData` パーツ、ない場合は `text` パーツを使用する
  - `image` 付きリクエストで `sendMessageStream([{inlineData: {data, mimeType}}])` が呼び出せる
  - `message` と `image` の両方が未指定の場合は 400 を返す
  - `image.mimeType` が `image/` で始まらない場合は 400 を返す（サーバー側 MIME バリデーション）
  - _Boundary: /api/chat route, SYSTEM_PROMPT_
  - _Requirements: 3.1, 3.2, 6.1, 6.2_

- [ ] 3.2 (P) `use-session-storage` の保存時に画像データを除去
  - `saveCurrentSession` 内で `messages.map(({ role, content }) => ({ role, content }))` により `image` フィールドを除去してから localStorage に書き込む
  - `archiveCurrentSession` でも同様に `image` フィールドを除去する
  - localStorage に書き込まれるメッセージに `image` フィールドが含まれない（ADR-002 の `content: string` 不変条件を維持）
  - _Boundary: use-session-storage_
  - _Requirements: 5.1, 5.2_

- [ ] 4. Integration — チャットページへの統合
- [ ] 4.1 チャットページに画像送信フローを統合
  - `ChatInput` に `onImageSubmit` コールバックを渡す
  - `handleSendImage(image: CompressedImage)` ハンドラを実装し、セッション ID 未初期化時の ID 生成と `useChat.sendImage(image)` 呼び出しを行う
  - 読み取り専用モード中は画像ボタンが含む `ChatInput` が非表示になる（既存の `viewingSession === null` 条件を共有）
  - 写真送信 → AI ストリーミング返答 → テキスト追加質問 → AI 返答のフロー全体が手動確認で動作する
  - _Depends: 2.1, 2.2, 2.3, 3.1, 3.2_
  - _Requirements: 1.1, 3.1, 3.4, 4.1, 4.2_

- [ ] 5. Validation — テストと検証
- [ ] 5.1 `ChatInput` 写真機能のコンポーネントテスト
  - 写真ボタンが表示され、クリックでファイルピッカーがトリガーされることを検証
  - 画像ファイル選択後にプレビュー状態へ遷移し、キャンセルで通常入力状態に戻ることを検証
  - `disabled=true` 時に写真ボタンが無効化されることを検証
  - 非画像ファイル選択時にエラーメッセージが表示されプレビューへ遷移しないことを検証
  - テストが全項目 PASS する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.2_

- [ ] 5.2 `useChat.sendImage` フックテスト
  - `fetch` をモックし、`sendImage` 呼び出し後に `{role:"user", content:"[写真]", image:{...}}` が messages に追加されることを検証
  - ストリーミング完了後に `onStreamComplete` が最新 messages を引数に呼ばれることを検証
  - 429 エラー時に適切な日本語エラーメッセージが `error` state にセットされることを検証
  - テストが全項目 PASS する
  - _Requirements: 3.1, 3.3, 4.1, 6.1_

- [ ] 5.3 `/api/chat` ルートのマルチモーダルテスト
  - `@google/genai` をモックし、`image` 付きリクエストで `sendMessageStream` に `inlineData` パーツが渡されることを検証
  - `message` と `image` 両方なしのリクエストで 400 を返すことを検証
  - `image.mimeType` が `image/` で始まらないリクエストで 400 を返すことを検証
  - テストが全項目 PASS する
  - _Requirements: 3.1, 6.1, 6.2_

- [ ] 5.4 `use-session-storage` 画像除去テスト
  - `image` フィールド付きメッセージを `saveCurrentSession` に渡した後、localStorage の JSON に `image` が含まれないことを検証
  - `image` フィールド付きメッセージを `archiveCurrentSession` に渡した後、localStorage の JSON に `image` が含まれないことを検証
  - テストが両ケースとも PASS する
  - _Requirements: 5.1, 5.2_

- [ ]* 5.5 `ChatMessage` 画像表示のコンポーネントテスト（オプショナル）
  - `message.image` 存在時に `<img>` タグが描画され、`message.image === undefined` 時にテキストが描画されることを検証
  - `content: "[写真]"` かつ `image` なしのメッセージがテキストバブルとして表示されることを検証
  - _Requirements: 2.1, 5.1_
