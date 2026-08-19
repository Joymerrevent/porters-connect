# RV-28 🟢 `count` の範囲を送信前に検証しない

- 重要度: 🟢 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: fixed

## 概要

送信前ガードは `keywords`（100 字）・`itemstate` の condition 制限・リクエスト長（~15000 字）・
Attachment の 10MB と揃っているのに、**`count` の 1〜200 だけ検証されない**。

## 根拠

- `src/resources/resource.ts:183` — `if (q.count !== undefined) p.set("count", String(q.count))` ＝ 素通し。
- `src/resources/query.ts:237-249` — keywords は検証している（対比）。
- `docs/reference/resource-api/README.md`（Read パラメータ表）— `count` は **1〜200・既定 10**。
- master 系（`src/resources/user.ts:79` 等）も同様に素通し。

## 影響

`count: 500` がそのまま送信され、**不透明なサーバー応答に倒れる**。
利用者は「なぜ結果が期待と違うのか」を自力で切り分けることになる。

実害は小さい（多くの利用者は `searchAll` を使うか 200 以下を指定する）が、
**「早く・明確に落とす」系列から 1 つだけ外れている**のが問題。
ガードが揃っていないと、利用者は「このライブラリは事前に弾いてくれる」という
期待を持てなくなる（部分的な保証は保証として機能しにくい）。

## 検出経緯

[2026-08-16-01][run816]。送信前ガードを 1 つずつ数え上げて、
正典のパラメータ表と突き合わせたところ `count` だけ対応物が無いと分かった。

## 推奨

`buildReadUrl` と各 master の URL 組立で範囲外を `PortersConfigError` にする（hint 付き）。
既存ガードと同じ形なので**新しい決定は不要**（ADR 不要）。

## 処置

`appendPaging(p, count, start)` を `src/resources/read-core.ts` に追加し、
**6 箇所に散っていた `count` / `start` の 2 行を 1 つのヘルパーへ集約**した
（`resource.ts` ＋ マスタ 4 種 ＋ `attachment.ts`）。ガードはその中に置いたので、
**すべての Read 経路に自動で効く**（後から Read を足しても素通りしない）。

範囲外（0 / -1 / 201 / 500）と**非整数**（`1.5`）を `PortersConfigError` で弾く。
`category: "config"`・hint は「`searchAll()` で全ページを辿れ」と案内する。
`count` 省略時は何も載せない（API 既定の 10 に委ねる）挙動は不変。

呼び出し側は `async` なので同期 throw にはならない（[ADR-0046][adr46]）。
Option だけは `start` を持たない（[ADR-0022][adr22] 事実5）ので `appendPaging(p, q.count)` で呼ぶ。

semver は **minor**（送信できていた値が例外になる＝観測可能な挙動の変化）。

## 検証

- `src/resources/read-core.test.ts` に 6 ケース追加 — 範囲内（1 / 50 / 200）が載ること、
  省略時に何も載らないこと、範囲外 4 種と非整数を弾くこと、`category` と hint が付くこと。
- **フェイクサーバーのテストが 1 件落ちて、それが正しい反応だった**。
  `test/fake/query.test.ts` の「サーバーが count を 200 に丸める」検証は
  `buildReadUrl` 経由で `count: 5000` を渡していたが、**ライブラリが送信前に弾くようになったので通らない**。
  見たいのは**サーバー側**の挙動（ライブラリを使わないクライアントからは 5000 が届きうる）なので、
  URL を直接組んで `parseReadQuery` に渡す形へ直した。サーバーの丸め処理はそのまま検証している。
- README とガイドの「送信前に落ちるもの」の表を更新（`count` の ❌ を ✅ に）。

[adr22]: ../../adr/0022-master-read-query-surface.md
[adr46]: ../../adr/0046-guard-error-contract.md
[run816]: ../2026-08-16-01.md
