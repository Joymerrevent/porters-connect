# RV-141 🟢 hostname の未設定や BigInt の id で、PortersError ではない TypeError が漏れる

- 重要度: 🟢 ／ 観点: エラーモデル
- 状態: open

## 概要

`hostname: undefined`（`PORTERS_HOST` の未設定）や `hostname: 123` は、構築時に `TypeError: Cannot read properties of undefined (reading 'includes')` になる。`tenant(2n)` と `of(1n)` は、エラーのメッセージを組み立てる `JSON.stringify` が BigInt を扱えず `TypeError` を投げる。

## 根拠

- `src/http/access-point.ts` の `assertHostname`、`src/porters-client.ts` の `assertPartitionId`、`src/accessor/resource-value-for.ts`。hostname と tenant は実測、of は読んだだけ（再レビュー・2026-09-26）。hostname の件は RV-93 の修正より前からある。

## 影響

🟢。送る前に止まるので安全側。いちばん起きやすい設定の誤り（環境変数の未設定）で、エラーの種類が PortersError でなくなる。

## 検出経緯

2026-09-26 の通信と認証の Low の修正（fix/http-auth-low-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- `hostname` が空でない文字列かを最初に確かめる。メッセージに値を出すときは BigInt も表せる形にする（RV-126 と同じ直し方）。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
