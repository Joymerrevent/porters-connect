# RV-65 🔴 送信済みの `create` が通信エラーで失敗すると、`retryable: true` のまま hint も無しに届く

- 重要度: 🔴 ／ 観点: エラーモデル / フェイルセーフ
- 状態: fixed

## 概要

非冪等な書き込み（`create`）が送信後に通信エラーで失敗したとき、ライブラリは再送を止めるが、利用者に届くエラーは元の `PortersNetworkError`（`retryable: true`、hint なし）のままになっている。

## 根拠

- `src/http/requester.ts:126` の `recoveryFor` が `"throw"` を返し、`src/http/requester.ts:181` の `throw e` が元のエラーをそのまま投げる。
- [ADR-0010][adr10] の決定は「`PortersNetworkError`（`retryable: false`）で surface し、hint『登録された可能性あり。重複を確認のうえ再実行を』」。この hint は `src` にも `docs/usage` にも無い（grep）。
- 実測（2026-09-26）: 送信時に通信エラーを投げる偽の transport で `candidate.create` を呼ぶと、送信は 1 回で止まり、届いたエラーは `retryable: true`・`hint: undefined`。

## 影響

🔴。`docs/usage/topics/errors.md` は「`retryable` が再試行してよいかを持ちます」と案内している。その案内どおり「`retryable` なら再送」と書いた利用者は、登録済みかもしれないレコードを二重に作る。削除 API は無いので取り消せない。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `recoveryFor` が「送信済みで結果が分からない書き込み」と判断して止めたときは、`retryable: false` と「登録された可能性あり」の hint を持つエラーに包み直し、元のエラーは `cause` に置く（[ADR-0010][adr10] の決定どおり。新しい ADR は要らない）。

## 処置

**実施（2026-09-26・fix/http-auth-review・`5832644`）。** `src/http/requester.ts` の `recoveryFor` が、送信済みの非冪等な書き込みの通信エラーに `"unknownOutcome"` を返し、`asUnknownOutcome` が `retryable: false` と「登録された可能性あり」の hint を持つエラーに包み直す（元のエラーは `cause`）。[ADR-0010][adr10] の決定どおり。

## 検証

`src/http/requester.test.ts` の `recoveryFor` / `asUnknownOutcome` のテストと、送信済みの `create` が `retryable: false`・hint 付きで届き 1 回しか送らないテスト。`requester.ts` のミューテーションはすべて検出。

[adr10]: ../../adr/0010-retry-throttle.md
