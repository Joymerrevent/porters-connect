# RV-81 🟡 JS から `attachment.create` の項目を渡し忘れると、`undefined` の文字列を送る

- 重要度: 🟡 ／ 観点: フェイルセーフ
- 状態: open

## 概要

添付ファイルの `create` は 4 項目を実行時に確かめない。`content` を渡し忘れると `<Content>undefined</Content>` を送る。

## 根拠

- `src/resources/attachment.ts:272` 付近の `tag()` が `String(value)` で書き出し、`guardContent` は `undefined` を通す。
- 実測（2026-09-26）: `content` を渡さずに `create` を呼ぶと、送った本文に `<Content>undefined</Content>` が入った。サブエージェントの実測では、`resourceId: NaN` も `<ResourceId>NaN</ResourceId>` として送られた。

## 影響

🟡。壊れた添付ファイルが登録される。削除 API が無いので取り消せない。型で止まるのは TypeScript の利用者だけ。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `create` で 4 項目が文字列 / 整数であることを実行時に確かめる。`content` は Base64 の文字だけであることも確かめる。

## 処置

—
