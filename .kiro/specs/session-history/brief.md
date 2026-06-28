# Brief: session-history

## Problem

チャットアプリで一度終わった会話を後から見返したい。また、複数のトピックを独立したセッションとして管理し、会話が混ざらないようにしたい。ページをリフレッシュしても会話が消えないようにする必要がある。

## Current State

chat-core スペック完了後、チャットUIは動作するがページリフレッシュで会話が消える。複数セッションの管理機能なし。

## Desired Outcome

- チャット終了後（ページリフレッシュ・再訪問）も会話が復元される
- 「新しい会話」ボタンで新しいチャットを開始できる
- ドロワーから過去最大3セッションを参照できる
- 過去セッションは読み取り専用で閲覧できる（ADR-003）
- 4セッション目開始時に最古のセッションが自動削除される（ADR-001）
- AIのストリーミング完了後にlocalStorageへ保存される（ADR-002）
- エラー発生時はlocalStorageに書き込まない（ADR-002）
- ドロワーの各セッションには最初のユーザーメッセージ冒頭（30文字）を表示する

## Approach

ADR-001・ADR-002・ADR-003 の決定に従い実装。`currentSessionId`（独立キー）+ `sessions`（配列キー）の2種類のlocalStorageキーで管理。セッションIDはUUIDで最初のメッセージ送信時に生成。evictionは「新しい会話」ボタン押下時にトリガー。shadcn/ui の Sheet コンポーネントをドロワーに使用。

## Scope

- **In**: `useSessionStorage` カスタムフック（localStorageの読み書き・eviction）、セッション型定義（`Session`）、ドロワーUI（shadcn/ui Sheet）、過去セッション一覧表示、読み取り専用モード（「現在の会話に戻る」ボタン）、「新しい会話」ボタンのロジック・disabled制御、ページリフレッシュ時のセッション復元
- **Out**: チャットUIそのもの（chat-core が担当）、認証（auth が担当）

## Boundary Candidates

- `Session` 型定義（`{ id: string, createdAt: number, messages: Message[] }`）
- `useSessionStorage` カスタムフック（CRUD + eviction）
- `Drawer` コンポーネント（shadcn/ui Sheet ベース）
- `SessionListItem` コンポーネント（セッション一覧の各行）
- 読み取り専用モードのバナー（「現在の会話に戻る」ボタン）
- ストリーミング完了コールバックでの保存トリガー

## Out of Boundary

- AIとの通信（chat-core が担当）
- メッセージのMarkdownレンダリング（chat-core の `ChatMessage` を再利用）

## Upstream / Downstream

- **Upstream**: chat-core（`Message` 型と `useChat` インターフェースを利用）
- **Downstream**: なし（このスペックがアプリの最終レイヤー）

## Existing Spec Touchpoints

- **Extends**: chat-core（チャット画面にドロワーと保存ロジックを統合）
- **Adjacent**: auth（ログアウト時にlocalStorageを削除しないことを確認 ← ADR-002）

## Constraints

- ADR-001: セッションIDは最初のメッセージ送信時に生成
- ADR-001: localStorageは過去3件 + 現在1件の最大4件を保持
- ADR-001: evictionのトリガーは「新しい会話」ボタン押下時
- ADR-002: localStorage書き込みはストリーミング完了後に1回
- ADR-002: エラー時はlocalStorageに書き込まない
- ADR-002: ログアウト時にlocalStorageを削除しない
- ADR-003: 過去セッションは読み取り専用
- ADR-003: ルーティングなし（単一 `/chat` ページ内で状態管理）
- ADR-003: ストリーミング中は「新しい会話」ボタンを disabled にする
