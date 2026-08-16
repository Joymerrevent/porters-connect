# RV-13 🟡 HTTP ステータスを一切見ていない

- 重要度: 🟡 ／ 観点: エラーモデル / API 忠実性
- 状態: fixed

## 概要

`requester` は `transport.send()` の戻り値の **`status` を参照せず**、常に body を parse する。reference は「エラーは **HTTP 200 以外**、または `<Code>` が 0 以外」と 2 系統を定義しているのに、前者（HTTP レベルのエラー）が未処理。結果、502/503/429 やプロキシ・LB が返す非 XML ボディは `parseResourcePage` の「unparseable resource response」＝ `category: "unknown"` に落ち、**リトライ可否も判断できない**。`PortersError.httpStatus`（型にはある）は常に `undefined`

## 根拠

`src/http/requester.ts:105-106`（`const res = await o.transport.send(...); return parse(res.body);` — `res.status` 不使用）/ `src/http/fetch-transport.ts:27`（status は取得済み）/ `docs/reference/resource-api/README.md:78`「成功は HTTP 200 かつ `<Code>0`。エラーは HTTP 200 以外、または `<Code>` が 0 以外」/ `src/errors/porters-error.ts:36`（`httpStatus`）

## 検出経緯

[ADR-0043][adr43] フェイクサーバー phase 1 の実装中（フェイクが HTTP 400 を返す経路を作った際に判明）。フェイクの狙い＝「忠実度の強制関数」が実際に効いた例

## 推奨

`requester` で status を分類し `PortersError.httpStatus` に載せる（5xx→`server`・retryable / 429→`rateLimit`（現状どこも produce していない category）/ 4xx→`config` or `permission`）。ボディが PORTERS envelope ならそちらを優先。**挙動変更＝要 ADR**（エラー分類は [ADR-0006][adr6] の管轄）

## 処置

[ADR-0044][adr44] を **accepted**（案A＝status を分類しつつ envelope を優先・decider 2026-08-09）ののち**実装**。
`requester` が `res.status` を見るようになり、判定順は envelope 優先（PORTERS の `<Code>`/`<Error>` があればそれを採用し
`httpStatus` を添える）、envelope が無い非 2xx は `httpStatusCategory` で分類（5xx→`server` / 429→`rateLimit` /
408→`network` / 401・403→`permission` / その他 4xx→`config` / 未知→`unknown`・`code` は `null`）。
非 2xx は parse に成功しても値を返さない（プロキシの HTML が「空ページ」として通るため）。
retryable な 3 種は `PortersNetworkError` ＝非冪等な `create` は 5xx で自動再送しない。
これで `category: "rateLimit"`（RV-3 の予約値）が 429 経由で初めて produce される。
README・[エラーハンドリング ガイド][guide]に「非 PORTERS ボディの HTTP エラー」節を追加。写像は仮定なので LV-9 に紐づけ済み

[adr43]: ../../adr/0043-local-fake-server.md
[adr44]: ../../adr/0044-http-status-handling.md
[adr6]: ../../adr/0006-error-model.md
[guide]: ../../guide/error-handling.md
