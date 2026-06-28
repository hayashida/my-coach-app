# Requirements Document

## Introduction

中学生2名向け学習支援チャットアプリ「my-coach-app」の認証・プロジェクト初期化フィーチャー。Next.js App Router プロジェクトの基盤を構築し、Google OAuth 認証で許可されたユーザーのみがチャット機能にアクセスできるようにする。このフィーチャーは後続の chat-core・session-history フィーチャーの土台となる。

## Boundary Context

- **In scope**: アプリケーション基盤構築、Google OAuth ログイン・ログアウト、ALLOWED_EMAILS によるアクセス制御、ルート保護、ログインページ（`/`）、チャットページのシェル（`/chat`）
- **Out of scope**: チャットUI・AI返答機能（chat-core が担当）、localStorageセッション管理・ドロワー（session-history が担当）
- **Adjacent expectations**: chat-core は `/chat` ページが認証済みユーザーにのみ表示されることを前提とする。session-history はログアウト時に localStorage を削除しないことを期待する（ADR-002 の決定に従う）

## Requirements

### 1. アプリケーション基盤

**Objective**: 開発者として、後続のチャット機能を実装できる Web アプリケーション基盤を得たい。後続フィーチャーの実装土台とするため。

#### Acceptance Criteria

1. The アプリ shall ローカル開発環境で起動してブラウザからアクセスできる
2. The アプリ shall 日本語テキストを含むページを正しく表示できる
3. The アプリ shall UIコンポーネントが利用可能な状態で提供される

### 2. ログイン

**Objective**: 利用者（中学生）として、Google アカウントでログインしてチャット機能を利用できるようにしたい。

#### Acceptance Criteria

1. The アプリ shall トップページ（`/`）に「Googleでログイン」ボタンを表示する
2. When ユーザーが「Googleでログイン」ボタンをクリックしたとき, the アプリ shall Google の認証フローを開始する
3. When 許可された Google アカウントでの認証が完了したとき, the アプリ shall チャットページ（`/chat`）にリダイレクトする

### 3. アクセス制御

**Objective**: 運営者として、登録した2名のユーザーのみがチャット機能にアクセスできるよう制限したい。Gemini API の無料枠を保護するため。

#### Acceptance Criteria

1. The アプリ shall 許可メールアドレス一覧を環境変数で管理する
2. When 許可されていない Google アカウントでのログインが試みられたとき, the アプリ shall 認証を拒否してエラーページを表示する
3. If 認証プロセス中にエラーが発生したとき, the アプリ shall エラーページを表示する

### 4. ルート保護

**Objective**: 運営者として、未認証ユーザーがチャット画面に直接アクセスできないようにしたい。

#### Acceptance Criteria

1. While 未認証状態のとき, when ユーザーが `/chat` にアクセスしたとき, the アプリ shall `/` にリダイレクトする
2. While 認証済み状態のとき, when ユーザーが `/` にアクセスしたとき, the アプリ shall `/chat` にリダイレクトする

### 5. ログアウト

**Objective**: 利用者として、チャット画面からいつでもログアウトできるようにしたい。

#### Acceptance Criteria

1. The アプリ shall チャットページ（`/chat`）にログアウトボタンを表示する
2. When ユーザーがログアウトボタンをクリックしたとき, the アプリ shall セッションを終了してトップページ（`/`）にリダイレクトする
