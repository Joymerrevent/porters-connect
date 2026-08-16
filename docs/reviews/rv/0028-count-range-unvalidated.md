# RV-28 🟢 `count` の範囲を送信前に検証しない

- 重要度: 🟢 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: open

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

—

[run816]: ../2026-08-16-01.md
