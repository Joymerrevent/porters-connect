# RV-76 🟡 fetch がリダイレクトを追いかけ、トークンや App Secret を別の宛先へ送る

- 重要度: 🟡 ／ 観点: セキュリティ / フェイルセーフ
- 状態: fixed

## 概要

fetch の `redirect` を指定していないので既定の follow になり、3xx の先へトークンのヘッダや App Secret の本文を送る。

## 根拠

- `src/http/fetch-transport.ts:59` 付近の `fetch` の呼び出しに `redirect` の指定が無い（コードを確認）。
- [ADR-0048][adr48] の趣旨は「credential を意図しない宛先へ送らない」。
- 実測（サブエージェント・2026-09-26）: 手元のサーバーから別のポートへ 307 を返すと、受け側に `X-porters-hrbc-oauth-token` と本文の `secret=` が届いた。

## 影響

🟡。中間の装置や設定の誤りで 3xx が返ると、credential が別の宛先に渡る。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `redirect: "manual"` を指定し、3xx をエラーとして扱う（3xx はすでに `unknown` に分類される）。

## 処置

**実施（2026-09-26・fix/http-auth-review・`13dd26b`）。** `src/http/fetch-transport.ts` で fetch に `redirect: "manual"` を渡し、3xx を追いかけずにそのまま応答として返す。

## 検証

`src/http/fetch-transport.test.ts` の「does not follow a redirect」が、本物の fetch とローカルのサーバーで、307 の転送先に何も届かないことを確かめる。

[adr48]: ../../adr/0048-access-point-host-validation.md
