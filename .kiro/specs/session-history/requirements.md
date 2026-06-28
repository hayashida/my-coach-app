# Requirements Document

## Introduction

中学生2名向けのAIコーチングチャットアプリ「my-coach-app」に、セッション永続化と履歴閲覧機能を追加する。ページリフレッシュ後も会話を復元でき、過去最大3セッションをドロワーUIから読み取り専用で閲覧できるようにする。

## Boundary Context

- **In scope**: ページリフレッシュ後のセッション復元、「新しい会話」ボタン、過去セッションのドロワー一覧表示、過去セッションの読み取り専用閲覧
- **Out of scope**: AIとの通信処理（chat-core が担当）、メッセージのMarkdownレンダリング（chat-core の `ChatMessage` を再利用）、認証処理（auth が担当）
- **Adjacent expectations**: chat-core が提供する `Message` 型（`role: "user" | "assistant"`, `content: string`）とストリーミング完了イベントをこの機能が利用する。ログアウト処理はセッションデータを削除しない（auth スペックへの期待）

## Requirements

### Requirement 1: セッション永続化

**Objective:** 利用者として、ページリフレッシュや再訪問後も直近の会話を復元したい。会話の途中でブラウザを再読み込みしても会話が失われないようにするため。

#### Acceptance Criteria

1. When AIメッセージのストリーミングが完了した後, the chat app shall 現在のセッション（ユーザーと AI のメッセージ全件）をブラウザのローカルストレージに保存する
2. When ページリフレッシュ後にチャット画面を開いた場合, the chat app shall 直前のセッションのメッセージ一覧を復元して表示する
3. If ストリーミング中にページリフレッシュが発生した場合, the chat app shall そのストリーミング交換分は失われた状態でチャット画面を表示する（保存済みの最後の完了済み交換までを復元する）
4. If AIメッセージ受信中にエラー（レート制限・通信エラー）が発生した場合, the chat app shall そのやり取りをローカルストレージへ書き込まない
5. The chat app shall ローカルストレージのセッションデータをログアウト操作のタイミングで削除しない

### Requirement 2: 新しい会話の開始

**Objective:** 利用者として、別のトピックの質問を始めるとき、過去の会話と混ざらない新しいチャットセッションを開始したい。複数トピックの学習を整理するため。

#### Acceptance Criteria

1. The chat app shall 画面上に「新しい会話」ボタンを常時表示する
2. When 利用者が「新しい会話」ボタンを押した場合, the chat app shall 現在のセッションを過去セッション一覧へ格上げし、空の新しいチャット画面を表示する
3. When 「新しい会話」ボタンが押された時点で過去セッションが既に3件存在する場合, the chat app shall 最も古いセッションを自動削除してから現在のセッションを格上げする
4. While AIがストリーミング応答中, the chat app shall 「新しい会話」ボタンを操作不能（disabled）にする
5. While 現在のセッションにメッセージが0件（空の状態）, the chat app shall 「新しい会話」ボタンを操作不能（disabled）にする

### Requirement 3: セッション履歴ドロワー

**Objective:** 利用者として、過去の会話を一覧から選んで参照したい。複数トピックの会話を管理し、過去のヒントを見返すため。

#### Acceptance Criteria

1. The chat app shall 過去のセッション一覧を表示するドロワーUIを提供する
2. When ドロワーを開いた場合, the chat app shall 保存済みの過去セッションを最大3件、最新順に一覧表示する
3. The chat app shall ドロワーの各セッション行に、そのセッションの最初のユーザーメッセージの冒頭30文字をプレビューとして表示する
4. If 現在のセッションにメッセージが0件の場合, the chat app shall そのセッションをドロワーの一覧に表示しない

### Requirement 4: 過去セッションの読み取り専用閲覧

**Objective:** 利用者として、過去の会話内容を見返したい。以前の質問とAIのヒントを再確認するため。

#### Acceptance Criteria

1. When ドロワーで過去のセッションを選択した場合, the chat app shall ドロワーを閉じてそのセッションのメッセージ一覧を読み取り専用モードで表示する
2. While 過去セッションを読み取り専用モードで表示中, the chat app shall メッセージ入力欄を非表示にする
3. While 過去セッションを読み取り専用モードで表示中, the chat app shall 画面上部に「現在の会話に戻る」ボタンを表示する
4. When 利用者が「現在の会話に戻る」ボタンを押した場合, the chat app shall 現在のアクティブなセッションのメッセージ一覧を表示し、メッセージ入力欄を再表示する
