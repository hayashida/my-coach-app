# Research & Design Decisions

---
**Feature**: `image-coaching`
**Discovery Scope**: Extension（chat-core の既存システムへの拡張）
**Key Findings**:
- `@google/genai` v2.10.0 は `inlineData` パーツでネイティブにマルチモーダルをサポート。追加ライブラリ不要。
- `Message` 型の `content: string` 不変条件（ADR-002）を維持するため、`image` フィールドは任意で追加し、localStorage 保存時に剥ぎ取る。
- Vercel Hobby プランのデフォルトリクエストサイズ制限 4.5MB に対し、圧縮後画像は ~200KB 以下。余裕十分。

---

## Research Log

### Gemini SDK マルチモーダル対応確認

- **Context**: 既存の `/api/chat` は `sendMessageStream({message: string})` のみ使用。画像を送るには `Part[]` 形式が必要。
- **Sources Consulted**: `node_modules/@google/genai/genai.d.ts`（`Part` 型定義）
- **Findings**:
  - `Part` インターフェースは `inlineData?: {data: string; mimeType: string}` を持つ
  - `sendMessageStream` は `string | Part[]` を受け付ける
  - ヘルパー関数 `createPartFromBase64(data, mimeType)` が利用可能
  - チャット履歴の各ターンも `{role, parts: Part[]}` 形式で構成可能
- **Implications**: 画像送信時は `chat.sendMessageStream([{inlineData: {data, mimeType}}])` を使用。テキスト履歴は `[{text: m.content}]`、画像履歴は `[{inlineData: m.image}]` に変換。

### localStorage 画像データ容量制限

- **Context**: ADR-002 の永続化戦略。スマートフォン写真は数MB になりうる。
- **Findings**:
  - localStorage は 1 オリジン 5〜10MB が一般的な上限
  - 1枚の高解像度写真（2MB）は base64 エンコード後 ~2.7MB
  - 圧縮なしで複数枚保存すると容量超過リスクが高い
- **Implications**: localStorage には画像バイナリを保存しない。`saveCurrentSession` 呼び出し前に `image` フィールドを除去。`use-session-storage.ts` でシリアライズ責務を持つ。

### Canvas API による画像圧縮

- **Context**: 追加ライブラリなしで圧縮する方法の評価
- **Findings**:
  - `createImageBitmap(file)` → `canvas.drawImage()` → `canvas.toBlob('image/jpeg', 0.7)` のパターンが標準
  - iOS Safari 15+ は `createImageBitmap` をサポート
  - 最大辺 1024px にリサイズ + JPEG 0.7 品質で典型的スマートフォン写真を ~150〜250KB に圧縮可能
  - 圧縮処理時間: 一般的なデバイスで 100〜500ms
- **Implications**: `src/lib/image-compression.ts` として実装。外部ライブラリ不要。

### 既存コードの拡張ポイント分析

- **Context**: chat-core の各コンポーネントへの影響範囲を特定
- **Findings**:
  - `ChatInput`: `onSubmit: (text: string) => void` prop のみ。`onImageSubmit: (image: CompressedImage) => void` を追加。
  - `ChatMessage`: `message.content` を string として直接レンダリング。`message.image` の有無で分岐を追加。
  - `useChat.sendMessage`: `text: string` のみ受け付ける。`sendImage(image)` を別関数として追加。
  - `/api/chat` route: `{message: string, history: Message[]}` を受け付ける。`image` フィールドをオプショナルに追加。
  - `use-session-storage.ts`: `saveCurrentSession(id, messages)` が `messages` をそのまま書き込む。`image` 剥ぎ取りロジックを追加。

---

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Selected |
|--------|-------------|-----------|---------------------|----------|
| Message型: オプショナル image フィールド | `Message.image?: {data, mimeType}` を追加 | content: string 不変条件維持、ADR-002 適合、既存コード変更最小 | image 存在チェックが必要 | ✅ |
| Message型: 判別ユニオン (type フィールド) | `TextMessage \| ImageMessage` の union | 型安全性が高い | 全消費者のtype narrowingが必要、breaking change 大 | ❌ |
| 専用 /api/photo-coach エンドポイント | 画像専用ルートを新設 | 関心分離が明確 | 重複コード（認証・ストリーミング）増加 | ❌ |
| /api/chat 拡張 | オプショナル image フィールドを追加 | コード再利用、パターン統一 | 1ルートの複雑度増加 | ✅ |

---

## Design Decisions

### Decision: Message.image を任意フィールドとして追加（判別ユニオンを採用しない）

- **Context**: `content: string` 不変条件（ADR-002）と型安全性のバランス
- **Alternatives Considered**:
  1. 判別ユニオン `TextMessage | ImageMessage` — breaking change が広い
  2. `content: string | ImageContent` — content の型を変える = 全コードに影響
  3. オプショナル `image?: {data, mimeType}` — content は常に string のまま
- **Selected Approach**: オプショナル `image` フィールド。`content` は画像メッセージでは `"[写真]"` を格納。
- **Rationale**: ADR-002 の不変条件維持（localStorage上では `content: string` のみ）。既存コードへの影響を最小化しつつ、新しい画像レンダリングを有効にする。
- **Trade-offs**: `message.image !== undefined` という条件チェックが必要だが、`type` フィールドによる narrowing より直感的。
- **Follow-up**: `image` フィールドは localStorage に保存されないため、セッション復元後は `content: "[写真]"` のテキストバブルとして表示される（Req 5.1）。

### Decision: 画像シリアライズを use-session-storage 層で一元管理

- **Context**: `image` データは localStorage に保存してはならない。剥ぎ取る場所の選択。
- **Alternatives Considered**:
  1. チャットページで `saveCurrentSession` 呼び出し前に剥ぎ取る — 漏れリスクあり
  2. `saveCurrentSession` 内部で剥ぎ取る — ストレージ層で完結
- **Selected Approach**: `saveCurrentSession` 内部で `messages.map(m => ({ role: m.role, content: m.content }))` してから `writeSessions`。
- **Rationale**: ストレージ層が永続化フォーマットの責任を持つべき（ADR-002の精神）。呼び出し側は意識不要。

### Decision: 画像圧縮を ChatInput 内ではなく専用 lib ユーティリティに委譲

- **Context**: テスト容易性と関心分離
- **Selected Approach**: `src/lib/image-compression.ts` に `compressImage(file: File): Promise<CompressedImage>` を実装。ChatInput はこれを呼び出す。
- **Rationale**: UI コンポーネントに Canvas API 処理を混在させない。圧縮ロジックを独立してテスト可能にする。

---

## Synthesis Outcomes

1. **Generalization**: テキスト送信と画像送信は `{content, history} → stream` の同一パターン。API ルートとフック双方で「メッセージの種別に応じた Parts 生成」として一般化。
2. **Build vs. Adopt**: 圧縮 = Canvas API（ネイティブ）、ピッカー = `<input type="file">`（ネイティブ）。外部依存ゼロ。
3. **Simplification**: 専用エンドポイント不要、専用コンポーネント不要（ChatMessage 内分岐）、専用フック不要（useChat に sendImage を追加）。

---

## Risks & Mitigations

- **iOS Safari の createImageBitmap 互換性** — iOS 15+ でサポート。対象ユーザー2名のデバイスが iOS 15 未満の場合は FileReader API へフォールバック必要。実装時に確認。
- **base64 画像データの API ペイロードサイズ** — 圧縮後 ~200KB、Vercel 4.5MB 制限に余裕あり。モニタリング不要だが、圧縮失敗時のガード必要。
- **Gemini 無料枠の画像処理コスト** — 画像入力は無料枠内でもトークン消費が多い。レート制限エラーは既存 429 ハンドリングで対応済み（Req 6.1）。

---

## References

- @google/genai v2.10.0 型定義: `node_modules/@google/genai/genai.d.ts`
- ADR-002: データ永続化戦略 — `adr/002-data-persistence.md`
- ADR-001: セッションのライフサイクル — `adr/001-session-lifecycle.md`
