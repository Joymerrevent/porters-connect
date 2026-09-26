# RV-75 🟡 同時に届いた 401 で取り直しが何度も走り、初回に同時に呼ばれると保存済みのトークンを使わない

- 重要度: 🟡 ／ 観点: 認証
- 状態: fixed

## 概要

トークンの取り直しは、どのトークンが失敗したかを見ずに毎回行う。そのため、同時に 401 を受けたリクエストの数だけ取り直しが走る。また、保存先の読み込みを待たずに `loaded` を立てるので、初回に同時に呼ばれると保存済みのトークンがあっても新しく取得する。

## 根拠

- `src/auth/token-manager.ts:126`（`ensure(forceRefresh)`）は失敗したトークンを受け取らない。
- `src/auth/token-manager.ts:108` で `loaded = true` を `await store.get()`（109 行）より前に立てる。
- [ADR-0012][adr12] は single-flight（まとめて 1 回にする）を決めている。
- 実測（サブエージェント・2026-09-26）: 5 本の同時の 401 で取り直しが 5 回走った。20ms かかる保存先に有効なトークンを入れて 3 本同時に呼ぶと、新しい取得が 1 回走った。

## 影響

🟡。月のアクセス数を無駄に使う。PORTERS が取り直しのたびに古いトークンを無効にするなら（未確認）、同時のリクエストの多くが失敗する。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 失敗したトークンを受け取り、手元のトークンがすでに別のものに替わっていれば取り直さずにそれを返す。保存先の読み込みも 1 本の Promise にまとめる。

## 処置

**実施（2026-09-26・fix/http-auth-review・`8499ef4`）。** 取り直しを頼むときに断られたトークン（`failedToken`）を渡し、手元のトークンがすでに別のものなら取り直さずにそれを使う（`src/auth/token-manager.ts` の `ensure`、`src/http/requester.ts`）。保存先の読み込みを 1 本の Promise にまとめた。

## 検証

`src/auth/token-manager.test.ts` の「renews once for requests refused together with the same token」「reuses a token another request already renewed」「makes calls that arrive during a slow store read wait for it」と、`requester.test.ts` の「passes the refused token along」。`token-manager.ts` のミューテーションはすべて検出。

[adr12]: ../../adr/0012-token-cache-refresh.md
