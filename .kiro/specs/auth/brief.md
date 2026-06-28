# Brief: auth

## Problem

チャットアプリへのアクセスを中学生2名に限定する必要がある。不特定多数がアクセスできる状態では、Gemini APIの無料枠を消費しきるリスクがある。また、Next.jsプロジェクト自体がまだ存在しないため、実装の土台となる初期化が必要。

## Current State

プロジェクトディレクトリにコードなし。DESIGN.md と ADR のみ存在。Next.js アプリケーション未作成。

## Desired Outcome

- `npx create-next-app` でNext.js App Router プロジェクトが初期化されている
- shadcn/ui が設定されている
- Googleアカウントでログイン・ログアウトできる
- `ALLOWED_EMAILS` 環境変数に列挙されたアドレスのみがチャット画面にアクセスできる
- 許可されていないアカウントはNextAuthのデフォルトエラーページに遷移する
- 未ログイン状態で `/chat` にアクセスすると `/` にリダイレクトされる
- ログイン成功後は `/chat` に遷移する

## Approach

NextAuth.js v5（Auth.js）+ Google OAuth プロバイダー。`signIn` コールバックで `ALLOWED_EMAILS` と照合し、不許可の場合は `false` を返す。Middleware で未認証ユーザーを `/` にリダイレクト。

## Scope

- **In**: Next.jsプロジェクト初期化（create-next-app）、shadcn/ui セットアップ、NextAuth.js v5 インストール・設定、Google OAuth プロバイダー、ALLOWED_EMAILS バリデーション、ログインページ（`/`）、Middleware によるルート保護、ログアウトボタン（チャット画面に配置するが実装はここで行う）
- **Out**: チャットUI、Gemini API、セッション管理、ドロワー

## Boundary Candidates

- Next.jsプロジェクト初期化・依存パッケージインストール
- NextAuth.js 設定ファイル（`auth.ts`, `auth.config.ts`）
- Middleware によるルート保護
- ログインページ UI（`/`）
- チャット画面のシェル（`/chat`、中身は chat-core スペックで実装）

## Out of Boundary

- チャットのUIコンポーネント（chat-core が担当）
- Gemini API 呼び出し（chat-core が担当）
- localStorageのセッション管理（session-history が担当）

## Upstream / Downstream

- **Upstream**: なし（このスペックが起点）
- **Downstream**: chat-core（`useSession()` で認証情報を参照）、session-history（認証済みユーザーのセッションを管理）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: なし

## Constraints

- NextAuth.js v5（Auth.js）を使用（v4 ではなく v5）
- Google OAuth クライアントID/シークレットは環境変数 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` で管理
- `ALLOWED_EMAILS` は環境変数（カンマ区切り）で管理
- `AUTH_SECRET` 環境変数が必要
