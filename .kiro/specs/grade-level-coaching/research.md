---

# Gap Analysis: 応答レベル（基本 / 応用）追加

## Context

本スペック `grade-level-coaching` は学年レベル（中学生 / 高校生）機能として既に実装完了済み（`implementation_complete: true` → 要件拡張により `requirements-generated` に巻き戻し）。今回の要件変更で、同一スペックのスコープに**応答レベル（基本 / 応用）**が追加された（Requirements 2.4/2.5, 4.2, 5, 6 が新規・変更）。本分析は、この追加分の実装ギャップを既存の学年レベル実装を踏まえて評価する。

## Requirement-to-Asset Map

| 要件 | 内容 | 既存資産 | ギャップ種別 |
|------|------|---------|------------|
| 5.1–5.4 | 応答レベルの選択・保存・既定値・不正値フォールバック | `src/types/grade-level.ts`, `src/hooks/use-grade-level.ts` と同型のパターンが確立済み | **Missing**（新規型・新規フック。パターンは既存） |
| 2.4–2.5 | 設定画面に応答レベルの表示・選択・保存を学年レベルと同一画面に統合 | `src/app/settings/page.tsx`（現在は学年レベルのみの単一 `selected` state + 単一保存ボタン） | **Missing + Constraint**（2フィールド化に伴うUI状態設計の判断が必要） |
| 4.2 | 応答レベルの保存失敗時もチャット継続 | `use-grade-level.ts` の「in-memory 先行更新 + サイレントキャッチ」パターンが確立済み、`grade-level-storage-failure.test.tsx` が既存の検証手法 | **Missing**（パターン踏襲のみ、新規リスクなし） |
| 6.1–6.2 | 応答レベルに応じたヒント発展度合いの指示文出し分け | `src/lib/system-prompt.ts` の `buildSystemPrompt(gradeLevel)` と `VOCABULARY_INSTRUCTIONS` の実装パターン | **Missing**（`buildSystemPrompt` のシグネチャ拡張が必要） |
| 6.3 | チャット送信時に応答レベルを反映 | `src/hooks/use-chat.ts`（`gradeLevel` を POST body に含める既存実装）、`src/app/chat/page.tsx`（`useGradeLevel()` → `useChat` 配線） | **Missing**（同型の追加配線） |
| 6.4 | 学年レベルの語彙制約を維持したまま応答レベルを調整 | `buildSystemPrompt` 内の指示文構成（語彙指示とヒント中心方針が独立した行として共存する設計） | **Constraint**（2軸の指示文をどう共存させるか、文言設計は設計フェーズで検討） |
| 6.5 | 既存のヒント中心コーチング方針を維持 | 共通指示（1〜4, 6〜8行目）が学年レベルに関わらず不変という既存設計方針 | **Constraint**（既存方針の踏襲のみ、新規リスクなし） |
| /api/chat route | `responseLevel` の受け付け・検証 | `route.ts` の `ChatRequest.gradeLevel?: string` + `isGradeLevel` 検証パターン | **Missing**（同型のフィールド追加） |
| SessionDrawer | 導線ラベルの整合 | 現在「学年レベル設定」という単一メニュー項目ラベル | **Constraint**（応答レベルも含む設定画面である旨をラベルに反映するか要判断） |

## Current State Investigation（学年レベル実装からの再利用パターン）

既存の学年レベル実装は、今回追加する応答レベルとほぼ同型の要件（1回設定・端末保存・既定値・不正値フォールバック・保存失敗時継続・チャット反映）を持ち、以下の確立済みパターンをそのまま再利用できる:

- **型定義パターン**（`src/types/grade-level.ts`）: `type` + `DEFAULT_*` + `is*` 型ガードの3点セット。9行程度の小さいファイル
- **フックパターン**（`src/hooks/use-grade-level.ts`）: `readXxx()`/`writeXxx()` の内部関数 + `useState` 初期化 + `setXxx` が in-memory 状態を先に更新してから永続化を試みる（Req 4.1/4.2 対応の中核パターン）。SSR安全（`typeof window === "undefined"` ガード）、try/catch サイレント失敗
- **プロンプト組み立てパターン**（`src/lib/system-prompt.ts`）: `Record<型, 文字列>` のルックアップテーブルを共通テンプレート内に埋め込む。今回は `VOCABULARY_INSTRUCTIONS` と同型の `HINT_DEPTH_INSTRUCTIONS: Record<ResponseLevel, string>` を追加し、`buildSystemPrompt` のシグネチャに `responseLevel` を足すだけで対応可能
- **API検証パターン**（`route.ts`）: `isXxx(body.xxx) ? body.xxx : DEFAULT_XXX` のフォールバック検証。`responseLevel` にもそのまま適用可能
- **配線パターン**（`use-chat.ts` → `ChatPage`）: オプショナルなフィールドを POST body に足し、呼び出し元がフックから取得した値を渡す

これらは全て「既存パターンの複製」であり、新規のアーキテクチャ判断はほぼ不要。唯一構造的に異なるのは **SettingsPage が単一フィールドから2フィールドの画面に変わる点**。

## Implementation Approach Options

### Option A: 既存ファイルへの直接統合（型・フックを共通化）
`grade-level.ts` と `use-grade-level.ts` に `responseLevel` 関連の型・ロジックを追記し、単一の型ファイル・単一のフックが両方の値を扱う。

- ✅ ファイル数が増えない
- ❌ ファイル名（`grade-level`）と実際の責務（学年レベル + 応答レベル）が乖離し、命名の一貫性が崩れる
- ❌ 学年レベルスペックが「所有」する境界が曖昧になり、将来的な変更時にどちらの値の変更か判別しにくい
- **評価**: 既存の命名規約・単一責任パターンと整合しないため非推奨

### Option B: 学年レベルと並行する新規コンポーネント作成（推奨）
`src/types/response-level.ts`、`src/hooks/use-response-level.ts` を新設し、学年レベルの実装と全く同型のパターンで実装する。`buildSystemPrompt`・`route.ts`・`use-chat.ts`・`ChatPage`・`SettingsPage`・`SessionDrawer` は既存ファイルを拡張する。

- ✅ 既存の学年レベル実装（それ自体が `image-coaching` スペックの `ChatRequest.image` 追加という前例に倣ったもの）とまったく同じ粒度の前例を踏襲でき、レビュー・テストの観点が既存パターンと一致する
- ✅ 型・フックの単一責任が保たれ、将来的にどちらかの値だけを変更する際の影響範囲が明確
- ✅ 新規ロジックはコピー＆パラメータ変更に近く、実装・テストの見積もりが立てやすい
- ❌ ファイル数がやや増える（型ファイル1、フックファイル1、テストファイル2）
- **評価**: 既存アーキテクチャとの一貫性・低リスクの観点から最有力

### Option C: ハイブリッド（値ごとに型は分離、フックは統合）
型定義（`response-level.ts`）は Option B と同様に新設するが、`useGradeLevel`/`useResponseLevel` を単一の `useCoachingSettings()` フックに統合し、`SettingsPage` が1回のフック呼び出しで両方の値・setter を取得できるようにする。

- ✅ `SettingsPage` 側の状態管理（2フィールドの selected 値 + 1つの保存ボタン）がまとめやすい
- ✅ 将来3つ目の設定項目が増えた場合の受け皿になる
- ❌ 学年レベル側の既存フック（`useGradeLevel`）を変更する必要があり、既存の呼び出し箇所（`ChatPage`, `use-grade-level.test.ts`）に影響が及ぶ。学年レベル実装は "implementation-complete" だった箇所への手戻りになる
- ❌ 現時点では2項目のみであり、統合の恩恵（重複削減）は小さい。過剰設計になるリスク
- **評価**: 現状の要件規模（2項目）に対しては過剰。ただし `SettingsPage` 側の保存ボタンの扱いは Option B を採用した場合でも同様の設計判断が残る（下記 Constraint 参照）

## Constraints / Research Needed for Design Phase

1. **SettingsPage の保存操作の粒度（Research Needed）**: Requirements 2.3・2.5 はそれぞれ独立した記述（学年レベルの保存 / 応答レベルの保存）だが、要件本文は「同じ画面上に表示」とのみ規定し、保存ボタンが1つか2つかは明記していない。現行 `SettingsPage` は単一の `selected: GradeLevel` state + 単一の保存ボタンという構造。応答レベル追加時、(a) 単一の保存ボタンで両方をまとめてコミットする、(b) 各設定項目ごとに独立した保存ボタンを持つ、の2パターンが考えられる。既存UIの自然な拡張は (a) だが、要件の独立記述（2.3/2.5, 4.1/4.2 がそれぞれ独立した If/When 条件）を厳密に読むと、一方の保存失敗が他方に影響しないことの検証しやすさの観点で (b) が要件と1対1対応しやすいという見方もできる。設計フェーズで確定要。
2. **応答レベルの列挙値の英語表現（Research Needed）**: 要件は「基本 / 応用」という日本語のみを規定。学年レベルは `"junior_high" | "high_school"` という意味ベースの命名を採用しているため、応答レベルも同様に意味ベースの命名（例: `"basic" | "advanced"`）が既存規約と整合する。設計フェーズで確定要。
3. **ヒント発展度合いの指示文と語彙制約の共存表現（Constraint、Req 6.4）**: `buildSystemPrompt` が学年レベル（語彙・既習範囲）と応答レベル（ヒントの発展度合い）という2軸の指示を1つのシステムプロンプト内で矛盾なく共存させる必要がある。既存実装は8行の指示のうち1行（5行目）のみが学年レベルで分岐する設計であり、応答レベル用の指示行を追加する形で対応可能。具体的な文言は設計フェーズで検討（要件60-79行目に基本/応用それぞれの期待する振る舞いの記述あり、これを指示文に変換する）。
4. **SessionDrawer の導線ラベル（Constraint、軽微）**: 現在のリンクラベルは「学年レベル設定」のみ。応答レベルも含む設定画面になるため、ラベル文言の見直し（例:「学年レベル・応答レベル設定」または「設定」への簡略化）を設計フェーズで検討。

## Effort & Risk

- **Effort: S（1〜3日）** — 既存の学年レベル実装と同型のパターンをそのまま複製できる（型・フック・API検証・POST配線はコピーに近い）。新規ファイルは6ファイル程度（型・フック・各テスト）+ 既存5ファイルへの小規模な追記（`system-prompt.ts`, `route.ts`, `use-chat.ts`, `ChatPage`, `SettingsPage`, `SessionDrawer`）。新規の外部依存・アーキテクチャ変更なし。
- **Risk: Low** — 直前の学年レベル実装（同一スペック内）が実質的に同じ要件形状で検証済みの前例となっており、技術的な不確実性はほぼ皆無。唯一の曖昧さは UI 側の保存ボタン粒度（Constraint 1）と列挙値命名（Constraint 2）という製品判断であり、技術リスクではない。

## Recommendations for Design Phase

- **Preferred approach**: Option B（学年レベルと並行する新規コンポーネント作成）。既存の `image-coaching` → `grade-level-coaching` という「既存 `ChatRequest`/`buildSystemPrompt` を拡張しつつ新規の型・フックを追加する」前例パターンをそのまま踏襲する
- **Key decisions to carry into design**:
  1. `SettingsPage` の保存ボタン粒度（単一 vs 個別）を確定する
  2. `ResponseLevel` の列挙値命名（`"basic" | "advanced"` 案を軸に検討）
  3. `buildSystemPrompt` のシグネチャを `buildSystemPrompt(gradeLevel: GradeLevel, responseLevel: ResponseLevel)` に拡張し、ヒント発展度合いの指示文言を確定する
- **Research items carried forward**: 上記 Constraints 1・2・3・4 は設計フェーズで確定し、design.md の Requirements Traceability に反映すること

---

## Design Decisions（設計フェーズで確定）

### Decision: ResponseLevel の列挙値命名

- **Context**: Constraint 2。応答レベルの列挙値の英語表現が要件では未規定
- **Alternatives Considered**:
  1. `"basic" | "advanced"` — 意味ベースの命名。`GradeLevel` の `"junior_high" | "high_school"` と同じ命名思想
  2. `"level1" | "level2"` — 汎用的な連番命名
- **Selected Approach**: `"basic" | "advanced"` を採用
- **Rationale**: `GradeLevel` 既存実装の命名規約（意味ベース）と一貫性を保つため。連番命名は将来的な意味の不明瞭化リスクがある
- **Trade-offs**: 将来「超発展」等の第3値を追加する場合、意味ベース命名は選択肢間の順序性を暗黙的に表現しないため列挙順に注意が必要（現状スコープ外のためリスクは低い）
- **Follow-up**: なし

### Decision: SettingsPage の保存操作の粒度

- **Context**: Constraint 1。学年レベル・応答レベルの保存操作を単一ボタンにするか個別ボタンにするか、要件（2.3/2.5, 4.1/4.2 の独立した記述）からは一意に決まらない
- **Alternatives Considered**:
  1. 個別保存ボタン（学年レベル用・応答レベル用をそれぞれ独立させる）
  2. 単一保存ボタン（両方の選択値をまとめてコミットする）
- **Selected Approach**: 単一保存ボタン。押下時に `setGradeLevel(selectedGrade)` と `setResponseLevel(selectedResponse)` を順に呼び出す
- **Rationale**: 各フックの `setXxx` は独立した localStorage キー・独立した try/catch を持つため、単一ボタンでも一方の保存失敗が他方に波及しない。Req 4.1/4.2 の独立性は保存操作の粒度とは無関係に成立する。既存 UI パターン（学年レベル単独時代の単一 `selected` state + 単一ボタン）を素直に拡張でき、UI の複雑化を避けられる
- **Trade-offs**: 個別ボタンの方が「どちらを保存したか」のユーザーへのフィードバックは明確になり得るが、要件はそこまで求めていない。過剰設計を避けるため単一ボタンを選択した
- **Follow-up**: 実装時、保存ボタン押下時の2フック呼び出し順序（学年レベル→応答レベル）をテストの前提として固定する

### Decision: buildSystemPrompt の2軸指示文の共存表現

- **Context**: Req 6.4。学年レベル（語彙）と応答レベル（ヒント発展度合い）の指示を1つの `systemInstruction` 内で矛盾なく共存させる必要がある
- **Alternatives Considered**:
  1. 学年レベルと応答レベルの組み合わせごとに個別の文言テンプレートを用意する（4通り）
  2. 語彙指示行とヒント発展度合い指示行を独立した別々の行として追加する
- **Selected Approach**: オプション2。既存の `VOCABULARY_INSTRUCTIONS`（学年レベル軸）に加え、新規 `HINT_DEPTH_INSTRUCTIONS`（応答レベル軸）を独立したルックアップテーブルとして定義し、`buildSystemPrompt` 内で別々の指示行として結合する
- **Rationale**: 要件の Out of Scope が「組み合わせごとの個別文言テンプレートの外部設定化」を明示的に除外しており、2軸を独立変数として扱う設計が要件の意図と整合する。既存実装（学年レベルが9行中1行のみ分岐）と同じ粒度パターンを踏襲でき、組み合わせ数が増えても行の追加のみで対応可能（4通りの掛け合わせ文言を保持する必要がない）
- **Trade-offs**: 2軸が完全に独立であるため、学年レベル×応答レベルの特定の組み合わせに特化した言い回しの微調整はできない。現行要件はそこまで求めていない
- **Follow-up**: なし

### Decision: SessionDrawer の導線ラベル

- **Context**: Constraint 4。応答レベルも含む設定画面になるため、既存の「学年レベル設定」ラベルの見直しが必要
- **Alternatives Considered**:
  1. 「設定」への簡略化
  2. 「学年レベル・応答レベル設定」への具体化
- **Selected Approach**: 「学年レベル・応答レベル設定」を採用
- **Rationale**: 画面遷移前にリンクの内容が明確に伝わることを優先した。「設定」への簡略化は将来項目が増えるたびに再度ラベル変更が必要になる可能性があるが、現状2項目であれば具体的なラベルの方がユーザーにとって分かりやすい
- **Trade-offs**: 将来3つ目の設定項目が増えた場合、ラベルの再見直しが必要になる（Revalidation Trigger として design.md に記録済み）
- **Follow-up**: なし
