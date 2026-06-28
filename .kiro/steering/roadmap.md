# Roadmap

## Overview

中学生2名向けの学習支援チャットアプリ「my-coach-app」の実装ロードマップ。
問題の答えをそのまま教えるのではなく、AIがコーチング形式でヒント・考え方を段階的に提示する。
Next.js App Router + Google Gemini 2.0 Flash + NextAuth.js v5 で構成し、Vercel Hobby プランに無料デプロイする。

## Approach Decision

- **Chosen**: 3スペック縦割り分解（auth → chat-core → session-history）
- **Why**: 各スペックが独立したドメイン境界を持ち、実装とレビューを段階的に進められる。認証が先行することで、後続スペックが認証済みセッションを前提に設計できる。
- **Rejected alternatives**: 1スペック一括実装は20タスクを超えるため管理が難しい。2スペック統合はセッション管理とUI設計の責務が混在する。

## Scope

- **In**: Google OAuth認証、チャットUI、Gemini APIストリーミング、localStorageセッション管理、ドロワーナビゲーション
- **Out**: 画像アップロード、会話履歴の永続保存（DB）、数式レンダリング（KaTeX）、AIトーン選択

## Constraints

- Gemini 2.0 Flash 無料枠内で運用（レート制限エラーのハンドリング必須）
- Vercel Hobby プラン（無料）
- 利用者は中学生2名のみ（不特定多数への公開なし）
- localStorageはユーザーIDでスコープしない（別デバイス使用前提）

## Boundary Strategy

- **Why this split**: 認証・チャット・セッション管理は独立したライフサイクルを持つ。認証なしでチャットは成立せず、チャットなしでセッション管理は意味をなさない。
- **Shared seams to watch**: `useSession()` の Session 型は auth スペックが定義し、chat-core がインポートする。セッションのデータ型（Message, Session）は chat-core が定義し、session-history が利用する。

## Specs (dependency order)

- [ ] auth -- Next.jsプロジェクト初期化 + NextAuth.js v5 + Google OAuth + ALLOWED_EMAILS + ログインページ。Dependencies: none
- [ ] chat-core -- チャットUI + Gemini API Route Handler + ストリーミング + Markdownレンダリング。Dependencies: auth
- [ ] session-history -- localStorageセッション管理 + ドロワーナビゲーション + 読み取り専用モード。Dependencies: chat-core
