# RV-113 🟢 `tenant()` の partition の id と、`of()` の名前を実行時に確かめていない

- 重要度: 🟢 ／ 観点: 設定検証
- 状態: fixed

## 概要

NaN・`"12 "`・-1・1.5 がそのまま `partition=` になる。JS から渡した知らない名前は `resource=undefined` で送る。

## 根拠

- `src/porters-client.ts:318`（`createTenantScope`）ほか。実測（サブエージェント）。

## 影響

🟢。PORTERS 側のエラーになるので、黙っては通らない。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- id は正の整数、名前は表にあるものに限る。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-26・fix/http-auth-low-review・`2754d33`）。** `tenant(id)` の id を正の整数に限る。添付ファイル・Phase・Field の `of(name)` は、表に無い名前を `resourceValueFor` で止める（prototype のプロパティも名前として扱わない）。

## 検証

`src/porters-client.test.ts` の「tenant(id) checks the partition id」、`src/accessor/resource-value-for.test.ts`、各リソースの「of refuses a name missing from the Resource List」。
