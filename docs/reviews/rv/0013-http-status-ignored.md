# RV-13 🟡 requester が HTTP ステータスを一切見ていない

- 重要度: 🟡 ／ 観点: エラーモデル / API 忠実性
- 状態: fixed

## 概要

`requester` は `transport.send()` の戻り値の **`status` を参照せず**、常に body を parse していた。
正典はエラーを「**HTTP 200 以外**」と「`<Code>` が 0 以外」の 2 系統で定義しているのに、
**前者がまったく処理されていない**。

## 根拠

- `src/http/requester.ts:105-106` — `const res = await o.transport.send(...); return parse(res.body);`
  ＝ `res.status` を使っていない。
- `src/http/fetch-transport.ts:27` — status は取得済み（捨てているのは requester 側）。
- `docs/reference/resource-api/README.md:78` — 「成功は HTTP 200 かつ `<Code>0`。
  エラーは HTTP 200 以外、または `<Code>` が 0 以外」。
- `src/errors/porters-error.ts:36` — `httpStatus` は型にあるが**常に `undefined`**。

## 影響

502 / 503 / 429 やプロキシ・LB が返す**非 XML のボディ**が
`parseResourcePage` の「unparseable resource response」＝ `category: "unknown"` に落ちる。
`unknown` は retryable ではないので、**本来は自動回復できる一時障害が「原因不明・再試行不可」になる**。
利用者から見ると「たまに謎のエラーで止まる」という最も切り分けにくい形。
中間装置が居る環境でのみ発火するため 🟡 だが、発火時の診断困難さは大きい。

## 検出経緯

[ADR-0043][adr43] フェイクサーバー phase 1 の実装中（フェイクが HTTP 400 を返す経路を作った際に判明）。
**フェイクの狙い＝「忠実度の強制関数」が実際に効いた例**（[2026-08-09-01][run809]）。
単体テストは自分が用意した応答しか返さないので、エラー経路は「作ってみて初めて分かる」。

## 推奨

`requester` で status を分類し `PortersError.httpStatus` に載せる
（5xx → `server`・retryable ／ 429 → `rateLimit`（[RV-3][rv3] の予約値）／ 4xx → `config` or `permission`）。
ボディが PORTERS の envelope ならそちらを優先する。**挙動変更＝要 ADR**（[ADR-0006][adr6] の管轄）。

## 処置

[ADR-0044][adr44] を **accepted**（案A＝status を分類しつつ envelope を優先）ののち実装。
判定順は **envelope 優先**（PORTERS の `<Code>`/`<Error>` があればそれを採用し `httpStatus` を添える）、
envelope が無い非 2xx は `httpStatusCategory` で分類（5xx → `server` / 429 → `rateLimit` /
408 → `network` / 401・403 → `permission` / その他 4xx → `config` / 未知 → `unknown`・`code` は `null`）。
**非 2xx は parse に成功しても値を返さない**（プロキシの HTML が「空ページ」として通るため）。

## 検証

- retryable な 3 種は `PortersNetworkError` にしたので、**非冪等な `create` は 5xx で自動再送されない**
  （冪等性ガードが効く＝安全側）。副作用は [RV-22][rv22] として別に切り出した。
- これで `category: "rateLimit"`（[RV-3][rv3] の予約値）が **429 経由で初めて produce される**。
- README と[エラーハンドリング ガイド][guide]に「非 PORTERS ボディの HTTP エラー」節を追加。
- status → category の写像は仮定なので [live-verification][lv] **LV-9** に紐づけ済み
  （実 PORTERS で 429 が観測できるか自体が未確認）。

[adr6]: ../../adr/0006-error-model.md
[adr43]: ../../adr/0043-local-fake-server.md
[adr44]: ../../adr/0044-http-status-handling.md
[guide]: ../../guide/error-handling.md
[lv]: ../../live-verification.md
[rv3]: 0003-unreachable-ratelimit-category.md
[rv22]: 0022-ratelimit-create-no-retry.md
[run809]: ../2026-08-09-01.md
