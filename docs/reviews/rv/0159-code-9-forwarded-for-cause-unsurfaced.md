# RV-159 🟢 Code 9 が再試行のあとも続くときの原因（x-forwarded-for・GAS・Workers）が、エラーにも対処の文書にも出ない

- 重要度: 🟢 ／ 観点: エラーモデル / ドキュメント
- 状態: fixed

## 概要

正典は、Result Code 9（一時利用不可）が **`x-forwarded-for` ヘッダー**や **GAS / Cloudflare Workers** でも出ること、
そしてその場合は再試行しても直らないことを書いている。ライブラリは 9 を `transient` として再試行し、
上限まで失敗すると `hint` の無いエラーを返す。原因の候補は `reference/gotchas.md` にしか無く、
エラーの対処を引くページ（`topics/errors.md`・`reference/troubleshooting.md`）にも無い。

## 根拠

- 正典: `docs/usage/reference/resource-api/result-codes.md:28`「9 | 一時利用不可・メンテ（GAS / Cloudflare Workers、
  **`x-forwarded-for` ヘッダ**でも出る）| する（待ってから）。`x-forwarded-for` ヘッダが原因なら、しない」。
- 実装: `src/errors/resource-error.ts:14` は 9 を `transient`（再試行する）に分類する。`resourceHint`（`:52-58`）が
  `hint` を付けるのは 403 と 404 だけで、9 には付かない。
- 文書: `x-forwarded-for` が出てくるのは `docs/usage/reference/gotchas.md:27` と `:68` だけ。
  `topics/errors.md:130-134` と `:378` は 9 を「自動リトライ」と書くだけで、原因の候補を書いていない。
  `reference/troubleshooting.md` の症状の表には 9 の行が無い（406 / 601 の行はある・`:19`）。

## 影響

挙動は正典どおり（再試行は上限つきなので、無駄になるのは数秒）。困るのは、プロキシやサーバーレスの環境から呼んでいて
9 が続く利用者が、エラーから原因にたどり着けないこと。`hint` が無く、対処のページにも無いので、
「PORTERS が落ちている」と読んで待ち続けうる。原因は利用側の環境で、直すのも利用側。🟢。

## 検出経緯

2026-09-29 の run 1 で、観点 5 の「Result Code と `category` の対応」を `result-codes.md` の表と 1 行ずつ突き合わせていて、
「ライブラリが再試行するか」の列に条件が付いている行が 9 だけだと気づいた。

## 推奨

ADR 不要（挙動は変えない）。

- `resourceHint` に 9 の `hint` を足す（再試行しても 9 が続くなら、`x-forwarded-for` ヘッダーを付ける中間装置や、
  GAS / Cloudflare Workers から呼んでいないかを確かめる）。
- `reference/troubleshooting.md` の症状の表に「9 が続く」の行を足し、`topics/errors.md` の 9 の説明から
  `gotchas.md` の該当箇所を指す。

## 処置

推奨のとおり、`hint` と文書の両方に原因の候補を足した（2026-09-29・ADR 不要）。`category`（`transient`）と再試行する挙動は変えていない。

- `src/errors/resource-error.ts` の `resourceHint` に Code 9 の `hint` を足した。再試行しても 9 が続くなら、`x-forwarded-for` ヘッダを付ける
  プロキシや、Google Apps Script / Cloudflare Workers からの呼び出しを確かめるよう案内する。
- `docs/usage/reference/troubleshooting.md` の症状の表に「再試行しても一時利用不可が続く」（リソース `9`・`transient`）の行を足し、
  `gotchas.md` を指した。
- `docs/usage/topics/errors.md` の自動リトライの説明に、9 が続くときの原因の候補と、`hint` にも同じ案内が入ることを書いた。
- 利用者に見える変更なので、changeset（patch）を足した。

## 検証

- `src/errors/resource-error.test.ts` が、Code 9 の `hint` に `x-forwarded-for` と `Cloudflare Workers` が含まれることと、
  302 には `hint` が付かないこと（条件を `code === 9` に絞っていること）を pin している。
- テスト 2448 件すべて通過。`pnpm check`・`typecheck`・`lint:ts`・`format:check`・`check:api`・`check:usage` は緑。
- `src` 全体のミューテーションテストは 100.00（4129 件・survived 0）。`resource-error.ts` は 81 件をすべて検出した。
