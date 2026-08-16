# RV-28 🟢 `count` の範囲を送信前に検証しない

- 重要度: 🟢 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: open

## 概要

送信前ガードは `keywords`（100 字）・`itemstate` の condition 制限・リクエスト長（~15000 字）・
Attachment の 10MB と揃っているのに、**`count` の 1〜200 だけ検証されない**。
`count: 500` は送信され、不透明なサーバー応答に倒れる。ガードの対称性の穴（実害は小さいが、
「早く・明確に落とす」系列から 1 つだけ外れている）

## 根拠

`src/resources/resource.ts:183`（`if (q.count !== undefined) p.set("count", …)` ＝ 素通し）/
`src/resources/query.ts:237-249`（keywords は検証）/
`docs/reference/resource-api/README.md`（Read パラメータ表：`count` は 1〜200・既定 10）。
master 系（`user.ts:79` 等）も同様に素通し

## 推奨

`buildReadUrl` / 各 master の URL 組立で範囲外を `PortersConfigError` にする（hint 付き）。
既存ガードと同じ形なので**新しい決定は不要**（ADR 不要）

## 処置

—
