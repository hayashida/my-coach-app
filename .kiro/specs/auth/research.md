# Research & Design Decisions

---
**Feature**: `auth`
**Discovery Scope**: New Feature（グリーンフィールド）
**Key Findings**:
- NextAuth.js v5 では Split Config パターン（auth.config.ts + auth.ts）が Edge/Node.js 分離の公式パターン
- `authorized` コールバックで Middleware のルート保護とリダイレクトの両方を実装できる
- Server Actions で signIn/signOut を呼び出せるため、SessionProvider/useSession はこの spec では不要
- v5 の環境変数プレフィックスは `AUTH_*`（v4 の `NEXTAUTH_*` から変更）

---

## Research Log

### Split Config パターン（auth.config.ts vs auth.ts の分割）

- **Context**: Next.js の Middleware は Edge Runtime で動作するため、Node.js 固有の API（TCP ソケット等）が使えない。DB アダプターを持つ完全な NextAuth 設定を import するとランタイムエラーになる。
- **Sources Consulted**:
  - https://authjs.dev/guides/edge-compatibility
  - https://nextjs.org/learn/dashboard-app/adding-authentication
  - nextauthjs/next-auth GitHub discussions
- **Findings**:
  - `auth.config.ts`: Edge 互換の設定のみ（providers は空か軽量なもの、DB アダプター禁止）
  - `auth.ts`: 完全な設定（Google プロバイダー、signIn コールバック、必要に応じて DB アダプター）
  - Middleware は `import NextAuth from 'next-auth'; import { authConfig } from '@/auth.config'; export default NextAuth(authConfig).auth` のパターンで使用
  - 今回は DB アダプターを使用しないため、Split の主目的は「将来の拡張に備えた境界の明確化」と「パターン準拠」
- **Implications**: `auth.config.ts` に `authorized` コールバックを置くことで Middleware のルート保護ロジックを一元管理できる。`signIn` コールバック（ALLOWED_EMAILS 照合）は Node.js 側の `auth.ts` に置く。

### authorized コールバックでのリダイレクト制御

- **Context**: Req 4.1（未認証 + /chat → /）と Req 4.2（認証済み + / → /chat）の両方を Middleware で実装する方法を調査。
- **Findings**:
  - `authorized` コールバックは `false` を返すと `pages.signIn`（デフォルト `/?callbackUrl=...`、設定で変更可）にリダイレクトする
  - `Response.redirect(url)` を返すことでカスタムリダイレクトが可能（NextAuth.js v5 の機能）
  - この方法で `middleware.ts` は `NextAuth(authConfig).auth` を export するだけで済む（1行）
- **Implications**: Middleware に独自の条件分岐を書く必要がなく、すべての認証ロジックが `auth.config.ts` の `authorized` コールバックに集約される。

### Server Actions での signIn/signOut（SessionProvider 不要）

- **Context**: LoginButton と LogoutButton でのサインイン/アウト実装方法を調査。
- **Findings**:
  - v5 では `signIn`/`signOut` が `@/auth` からサーバー側関数として export される
  - `<form action={async () => { 'use server'; await signIn('google') }}>` で Client Component 不要
  - または `'use server'` の actions.ts に切り出して再利用
  - `useSession()` は Client Component でのリアルタイムセッション監視に必要だが、単純なログイン/ログアウトには不要
- **Implications**: SessionProvider のセットアップをこの spec に含める必要がない。chat-core が `useSession()` を必要とする場合は chat-core spec で追加する。

### v5 の環境変数命名

- **Findings**:
  - `AUTH_SECRET`（v4: `NEXTAUTH_SECRET`）
  - `AUTH_GOOGLE_ID`（v4: `GOOGLE_CLIENT_ID`）— Google プロバイダーが自動検出
  - `AUTH_GOOGLE_SECRET`（v4: `GOOGLE_CLIENT_SECRET`）— Google プロバイダーが自動検出
  - `AUTH_URL` は Vercel では不要（自動検出）
- **Implications**: 環境変数のプレフィックスを v5 形式に合わせる。`ALLOWED_EMAILS` はカスタム環境変数のためプレフィックスなしで OK。

### ファイル配置（src/ ディレクトリ使用時）

- **Findings**:
  - `src/` ディレクトリ使用時、`auth.config.ts`, `auth.ts`, `middleware.ts` はすべて `src/` 直下に置く
  - `@/` エイリアスは `src/` を指す（create-next-app のデフォルト）
  - Route Handler は `src/app/api/auth/[...nextauth]/route.ts`
- **Implications**: import パスは `@/auth`, `@/auth.config` で統一。

---

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|---|---|---|---|---|
| Split Config (採用) | auth.config.ts (Edge) + auth.ts (Node.js) | 公式推奨、将来の DB アダプター追加に対応 | ファイルが2つに分かれる | authjs.dev 公式パターン |
| 単一 auth.ts | 1ファイルに全設定 | シンプル | Middleware 使用時に Edge エラーリスク | DB アダプター不要な今回でも採用しない（パターン違反） |

---

## Design Decisions

### Decision: ALLOWED_EMAILS の配置（auth.ts vs auth.config.ts）

- **Context**: signIn コールバックで ALLOWED_EMAILS を照合する実装をどこに置くか
- **Alternatives Considered**:
  1. auth.config.ts — Edge 対応、Middleware からも参照可能
  2. auth.ts — Node.js 専用、Route Handler（OAuth コールバック処理）で実行
- **Selected Approach**: `auth.ts` の `signIn` コールバック
- **Rationale**: `signIn` コールバックは OAuth コールバック処理（Route Handler = Node.js）でのみ実行される。`auth.config.ts` は Middleware（Edge）で使用される設定のため、セキュリティロジックを Edge 側に持ち込まないほうが責務が明確。
- **Trade-offs**: Middleware では ALLOWED_EMAILS チェックが行われないが、`signIn` コールバックがセッション生成前に実行されるため問題なし
- **Follow-up**: ALLOWED_EMAILS が空の場合（環境変数未設定）は空配列扱いで全ログイン拒否 —— フェイルセーフとして実装を確認

### Decision: authorized コールバックで双方向リダイレクト

- **Context**: Middleware で「未認証→/」「認証済み→/chat」の両方のリダイレクトを実装する方法
- **Selected Approach**: `authorized` コールバック内で `Response.redirect()` を返す
- **Rationale**: NextAuth.js v5 の公式パターン。Middleware に独自ロジックを持ち込まずに済む
- **Trade-offs**: auth.config.ts にナビゲーションロジックが混在するが、認証ガードの一部として許容範囲

### Decision: LoginButton/LogoutButton の実装方式

- **Context**: ボタンの onclick で signIn/signOut を呼ぶ実装方式を選択
- **Alternatives Considered**:
  1. Client Component + `next-auth/react` の signIn/signOut
  2. Server Component の form + Server Action（'use server'）
- **Selected Approach**: Server Component の form + Server Action
- **Rationale**: App Router のサーバー優先アーキテクチャに沿う。`'use client'` 境界を増やさない。`next-auth/react` への依存が不要。
- **Trade-offs**: form タグが必要（ボタン単体ではなく `<form>` でラップ）

---

## Risks & Mitigations

- `AUTH_SECRET` 未設定 → JWT 署名失敗 / セッション無効 → `.env.local.example` に必須項目を明記
- Google OAuth アプリの「テストユーザー」制限 → 本番前に Google Cloud Console で許可ユーザーを追加する手順を README に記載
- `ALLOWED_EMAILS` 大文字小文字の不一致 → `.map(e => e.trim().toLowerCase())` で正規化（実装時に対応）
- Middleware の matcher が広すぎる → 静的ファイル・`_next/` を除外する matcher パターンを慎重に設定

---

## References

- [Auth.js: Edge Compatibility](https://authjs.dev/guides/edge-compatibility) — Split Config パターンの根拠
- [Auth.js: Session Management / Protecting](https://authjs.dev/getting-started/session-management/protecting) — authorized コールバック
- [Auth.js: Migrating to v5](https://authjs.dev/getting-started/migrating-to-v5) — v4→v5 変更点（環境変数名含む）
- [Next.js Learn: Adding Authentication](https://nextjs.org/learn/dashboard-app/adding-authentication) — 公式チュートリアル
- [shadcn/ui CLI](https://ui.shadcn.com/docs/cli) — `npx shadcn@latest init`
- `ADR-002` — ログアウト時に localStorage を削除しないことの決定
