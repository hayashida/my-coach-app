# Research & Design Decisions

## Summary
- **Feature**: `grade-level-coaching`
- **Discovery Scope**: Extension（既存の chat-core / session-history / auth スペックを拡張する軽量ディスカバリー）
- **Key Findings**:
  - サーバー側の永続化基盤（DB/KV/Prisma）が存在せず、認証も `ALLOWED_EMAILS` によるバイナリ許可リストのみでユーザーごとのアカウントレコードがない。学年レベルの永続化は端末ローカル（localStorage）以外の現実的な選択肢がない
  - `SYSTEM_PROMPT`（`src/lib/system-prompt.ts`）は中学生固定の静的文字列定数であり、パラメータ化の仕組みが一切ない。学年別出し分けには定数から関数への置き換えが必要
  - `use-session-storage.ts` が SSR 安全な localStorage 読み書きパターン（同期初期化 + try/catch サイレント失敗）を既に確立しており、`use-grade-level` はこのパターンをそのまま踏襲できる

## Research Log

### 既存の永続化・認証アーキテクチャ
- **Context**: 「プロフィール設定として保存」という当初の要件記述が、サーバー側アカウントを前提としているのか確認する必要があった
- **Sources Consulted**: `src/auth.ts`, `src/lib/allow-list.ts`, `.kiro/steering/roadmap.md`, `.kiro/specs/session-history/design.md`
- **Findings**:
  - `ALLOWED_EMAILS` はメールアドレスの許可/拒否のみを判定するバイナリ allowlist であり、ユーザーごとのレコードや役割を持たない
  - DB/KV 等のサーバー側永続化層はプロジェクト全体に存在しない
  - localStorage はユーザー ID でスコープされない設計（`coach_current_session_id`, `coach_sessions` は端末単位のグローバルキー）であり、ログアウトしてもクリアされない（ADR-002 準拠）
- **Implications**: 学年レベルもこの既存方針に合わせ、端末ローカル保存とする。これはユーザーへの確認質問で明示的に承認された方針でもある（要件定義フェーズで確認済み）

### システムプロンプトのパラメータ化
- **Context**: AI コーチングの学年別調整をどう実現するか
- **Sources Consulted**: `src/lib/system-prompt.ts`, `src/app/api/chat/route.ts`
- **Findings**: `SYSTEM_PROMPT` は唯一の消費者が `route.ts` であり、他に参照箇所がないため、定数から関数（`buildSystemPrompt(gradeLevel)`）への置き換えは後方互換性の懸念なく行える
- **Implications**: 語彙レベルに関する 1 行のみを学年で分岐させ、それ以外の既存コーチング指示（ヒント中心方針、写真分析指示）は共通のまま維持する設計とした

### 学年レベルをサーバーにどう伝えるか
- **Context**: 学年レベルはクライアント（localStorage）にのみ存在し、サーバー側にセッション状態がない
- **Sources Consulted**: `src/hooks/use-chat.ts`, `src/app/api/chat/route.ts`（既存の `ChatRequest` 構造）
- **Findings**: 既存の `image-coaching` スペックが `ChatRequest` に `image?` フィールドを追加した前例があり、同様のパターンでリクエストボディにフィールドを追加できる
- **Implications**: `gradeLevel` を `ChatRequest` に追加し、サーバー側で `isGradeLevel` により検証・フォールバックする。クライアントの改ざんや不整合があってもチャット機能自体は継続する（要件 4.1 と整合）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| localStorage 直接保存（採用） | `use-session-storage` と同型の読み書きフックを新設 | 新規依存なし、既存パターンと一貫、実装コスト最小 | 端末間で同期されない（既存方針として許容済み） | 採用 |
| サーバー側セッションに保存 | NextAuth セッションに学年レベルを持たせる | 端末間同期が可能 | アカウントレコード基盤が存在せず大規模な認証層の変更が必要。要件でも明示的に対象外とされた | 不採用 |
| Cookie 保存 | HTTPのみで完結、SSRから読める | サーバー側で直接読める | 新しい永続化機構を追加することになり、既存の localStorage 方針との一貫性がなくなる。要件は「端末ローカル保存（localStorage）」と明確に確認済み | 不採用 |

## Design Decisions

### Decision: 学年レベルをリクエストボディで都度送信する
- **Context**: サーバーに学年レベルの状態を持たせる仕組みがない
- **Alternatives Considered**:
  1. サーバー側で学年レベルをキャッシュ/セッション化する — アカウント基盤が必要で過剰
  2. リクエストごとにクライアントから送信する — 状態を持たずシンプル
- **Selected Approach**: `useChat` が `gradeLevel` を毎回の POST ボディに含め、`/api/chat` がその都度検証してプロンプトを構築する
- **Rationale**: 既存アーキテクチャ（ステートレスな `/api/chat`）と一貫し、新規の状態管理層を追加しない
- **Trade-offs**: サーバー側で学年レベルを信頼できないため必ず検証が必要になるが、これは既存の「クライアント入力は境界で検証する」原則の範囲内
- **Follow-up**: なし（実装時に `isGradeLevel` によるフォールバックを徹底する）

### Decision: SYSTEM_PROMPT を定数から関数に変更する
- **Context**: 学年別に異なる指示文を生成する必要がある
- **Alternatives Considered**:
  1. 学年ごとに定数を 2 つ用意する — 共通部分（ヒント中心方針等）が重複する
  2. 関数化して共通部分と可変部分を分離する — 重複を避けられる
- **Selected Approach**: `buildSystemPrompt(gradeLevel: GradeLevel): string` 関数とし、語彙レベルの 1 行のみ分岐させる
- **Rationale**: 重複を避けつつ、既存のコーチング方針（要件 3.4）を確実に両学年で共通維持できる
- **Trade-offs**: なし（唯一の消費者である `/api/chat` の呼び出し箇所を1箇所変更するのみ）
- **Follow-up**: なし

## Risks & Mitigations
- 学年レベルが端末ごとに異なりうる（同一ユーザーが別端末を使うと学年設定が引き継がれない）— 既存の localStorage 方針（別デバイス使用は非対応）と同じ制約であり、要件定義時に許容済み
- `/api/chat` がクライアントから送られた `gradeLevel` を無条件に信頼するとプロンプトインジェクション的な影響が懸念されるが、値は `"junior_high"`/`"high_school"` の列挙値に限定検証されるため任意文字列の注入は発生しない

## References
- `.kiro/specs/image-coaching/design.md` — `ChatRequest` へのフィールド追加、`/api/chat` 拡張の前例として参照
- `.kiro/specs/session-history/design.md` — localStorage 読み書きパターン（SSR安全な同期初期化）の参照元
- `.kiro/steering/roadmap.md` — 永続化方針・利用者規模の制約の根拠
