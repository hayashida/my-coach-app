# Implementation Plan

- [x] 1. Foundation: プロジェクト基盤のセットアップ

- [x] 1.1 Next.js App Router プロジェクトを初期化し shadcn/ui を設定する
  - `create-next-app` で TypeScript + Tailwind CSS + App Router + src/ ディレクトリ構成で初期化する
  - shadcn/ui を `npx shadcn@latest init` で初期化し、Button コンポーネントを追加する
  - `src/app/layout.tsx` の `<html>` タグに `lang="ja"` を設定する
  - ローカル開発サーバーが `http://localhost:3000` で起動し、`/` にアクセスできる
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.2 next-auth@5 をインストールし環境変数テンプレートを整備する
  - `next-auth@5` をプロジェクトにインストールする
  - `.env.local.example` ファイルを作成し `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS` の記載例を追加する
  - `.gitignore` に `.env.local` が含まれていることを確認し、なければ追加する
  - `.env.local.example` にすべての必須変数が記載されており、開発者がコピーしてすぐ使える状態になっている
  - _Requirements: 3.1_

- [x] 2. Core: NextAuth.js 認証設定

- [x] 2.1 NextAuth.js 基本設定とルート保護 Middleware を実装する
  - `src/auth.config.ts` に `authorized` コールバックを実装する：未認証ユーザーが `/chat` にアクセスすると `false` を返し `/` にリダイレクトさせる。認証済みユーザーが `/` にアクセスすると `Response.redirect("/chat")` を返す
  - `pages.signIn: "/"` を設定して未認証時のデフォルトリダイレクト先を指定する
  - `src/middleware.ts` で `NextAuth(authConfig).auth` をデフォルト export し、静的ファイル・`_next/*` を除外する matcher を設定する
  - 未認証状態で `/chat` にアクセスするとサーバーサイドで `/` にリダイレクトされる（ブラウザ確認可）
  - _Requirements: 4.1, 4.2_

- [x] 2.2 NextAuth.js メインインスタンスと ALLOWED_EMAILS アクセス制御を実装する
  - `src/auth.ts` に Google プロバイダーを設定した NextAuth インスタンスを作成し、`handlers`, `auth`, `signIn`, `signOut` を export する
  - `signIn` コールバックで `ALLOWED_EMAILS` 環境変数をカンマ区切りで分割し、大文字小文字を統一して(`toLowerCase`)メールアドレスを照合する
  - `ALLOWED_EMAILS` が未設定の場合は空配列として扱い、全ログインを拒否する（フェイルセーフ）
  - `profile?.email_verified` が `false` の場合もログインを拒否する
  - `src/app/api/auth/[...nextauth]/route.ts` で `handlers` を re-export する
  - `ALLOWED_EMAILS` に含まれないアカウントでのサインイン時に `signIn` コールバックが `false` を返す（テストで確認可）
  - _Requirements: 2.2, 2.3, 3.1, 3.2, 3.3_
  - _Depends: 2.1_

- [x] 3. Core: UI コンポーネントとページの実装

- [x] 3.1 (P) ログインボタンとログインページを実装する
  - `src/components/auth/login-button.tsx` に `<form>` タグと `'use server'` アクションで `signIn("google", { redirectTo: "/chat" })` を呼び出すボタンを実装する
  - `src/app/page.tsx` にアプリの説明テキストと `LoginButton` を含むログインページを実装する
  - ログインページ（`/`）にアクセスするとアプリ説明と「Google でログイン」ボタンが表示される
  - _Requirements: 2.1, 2.2, 2.3_
  - _Boundary: LoginButton, LoginPage_
  - _Depends: 2.2_

- [x] 3.2 (P) ログアウトボタンとチャットページシェルを実装する
  - `src/components/auth/logout-button.tsx` に `<form>` タグと `'use server'` アクションで `signOut({ redirectTo: "/" })` を呼び出すボタンを実装する
  - `src/app/chat/page.tsx` に `LogoutButton` を含むチャットページシェルを実装する（チャット本体のコンテンツは chat-core スペックが追加する）
  - `/chat` にアクセスするとログアウトボタンが表示される（ログアウトボタンをクリックすると `/` に遷移する）
  - _Requirements: 5.1, 5.2_
  - _Boundary: LogoutButton, ChatShell_
  - _Depends: 2.2_

- [x] 4. Validation: テストと動作確認

- [x] 4.1 ALLOWED_EMAILS アクセス制御の単体テストを書く
  - `signIn` コールバックロジックに対して以下の4ケースをテストする：
    - `ALLOWED_EMAILS` に含まれるメールアドレス → `true` を返す
    - `ALLOWED_EMAILS` に含まれないメールアドレス → `false` を返す
    - `ALLOWED_EMAILS` 環境変数が未設定 → `false` を返す（フェイルセーフ）
    - 大文字小文字が異なる場合も一致する（`User@Gmail.com` → `user@gmail.com` と同一視）
  - 4つのテストケースがすべて pass する
  - _Requirements: 3.1, 3.2_

- [x] 4.2 Middleware ルート保護の統合テストを書く
  - 未認証リクエストで `/chat` にアクセスすると `302` で `/` にリダイレクトされることをテストする
  - 認証済みセッションで `/` にアクセスすると `302` で `/chat` にリダイレクトされることをテストする
  - 認証済みセッションで `/chat` にアクセスすると 2xx で通過することをテストする
  - 3つのテストケースがすべて pass する
  - _Requirements: 4.1, 4.2_

- [ ]* 4.3 E2E テストで認証フロー全体を検証する（オプション）

## Implementation Notes
- [2.2] allow-list.ts は auth.ts から直接 import されておらず、テストは checkAllowedEmail ヘルパーをテストしている（本番コードは同等ロジックをインライン）。Task 4.1 で auth.ts の signIn コールバック本体を直接テストする際に統合する。
- [2.1] Next.js 16.x では `src/middleware.ts` が非推奨になり `src/proxy.ts` へのリネームが推奨される警告が出る（`⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`）。機能的影響はなく、設計書通り middleware.ts を使用。将来 Next.js 16 に完全対応する際は proxy.ts へのリネームと設計書更新が必要。
  - 許可されたアカウントでログインすると `/chat` に遷移することをテストする
  - 許可されていないアカウントでログイン試行するとエラーページが表示されることをテストする
  - `/chat` でログアウトボタンをクリックすると `/` に遷移することをテストする
  - 未ログイン状態で `/chat` に直接アクセスすると `/` にリダイレクトされることをテストする
  - _Requirements: 2.1, 2.2, 2.3, 3.2, 4.1, 4.2, 5.1, 5.2_
