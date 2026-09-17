# API エンドポイント × 機能 マトリクス（V1）

- ステータス: living（実装を変えたら同じ PR で更新する）
- 最終更新: 2026-09-15
- 位置づけ: [ロードマップ][roadmap] の **`1.0.0` 完成条件 V1**（機能網羅）の測定対象。
  **PORTERS Connect API のエンドポイントが取るもの**と、**本ライブラリが実際に送るもの**を
  1 枚に並べ、食い違うセルには必ず根拠（ADR か LV）を持たせる。
- 検査: `test/integration/endpoint-coverage.test.ts`（`pnpm test`）。
  本書の表は**人が読む表であると同時に検査の入力**で、reference とも実装とも**両方向**で突き合わせる。

## なぜこの文書があるか

D1〜D5（[ADR-0060][adr60]）は**項目の軸**を測った — リソースが揃っているか、標準項目が揃っているか、
Data Type が揃っているか。測っていなかったのが**操作とパラメータの軸**で、「Candidate は読める」は
言えても「Candidate Read が取る 8 つのパラメータを全部出しているか」は誰も見ていなかった。

[RV-23][rv23]（Candidate の静的カタログが標準 4 項目を欠いたまま 12 版通った）と同じ形の穴が
パラメータ側にも開きうる。項目は [reference ↔ カタログ突合][refcat]が塞いだので、**同じやり方を
パラメータに当てる**のがこの表である。

## 読み方

**表 A と表 B は別のことを言っている。** A は **PORTERS が取るもの**（出典の Input Variables）、
B は **ライブラリが送るもの**（実際に組み立てた URL）。**2 つがずれているセルが読みどころ**で、
ずれには根拠が要る。

表 A のセル:

| 記号 | 意味                       |
| ---- | -------------------------- |
| `●`  | 必須パラメータ             |
| `○`  | 任意パラメータ             |
| `—`  | そのエンドポイントには無い |

表 B・表 C のセルは「送るか」を先に書き、**表 A とずれているときだけ根拠を添える**:

| セル                | 意味                                                        |
| ------------------- | ----------------------------------------------------------- |
| `送る`              | 送る。表 A も挙げている（一致）                             |
| `—`                 | 送らない。表 A も挙げていない（一致）                       |
| `送る ⚠️ LV-n`      | 送るが表 A に無い。**実機で確かめるまで未確定**             |
| `送らない ⚠️ LV-n`  | 表 A は挙げているのに送らない。**実機で確かめるまで未確定** |
| `送らない ⛔ ADR-n` | 表 A は挙げているが、**意図的に送らない**（根拠は ADR）     |

根拠の無いずれも、ずれていないのに付いた根拠も、検査で落ちる。

---

## 表 A — PORTERS が取る Read パラメータ（出典）

出典は [Resource API 概要][rapi]（共通表）と、語彙が違う 6 エンドポイントの各ページ
（[Partition][r-partition] / [User][r-user] / [Field][r-field] / [Option][r-option] /
[Phase][r-phase] / [Attachment][r-attachment]）。エンドポイント固有のパラメータは**表 C**にある。

| エンドポイント    | partition | count | start | field | condition | keywords | order | itemstate |
| ----------------- | --------- | ----- | ----- | ----- | --------- | -------- | ----- | --------- |
| `/v1/partition`   | —         | ○     | ○     | —     | —         | —        | —     | —         |
| `/v1/user`        | ●         | ○     | ○     | ○     | —         | —        | —     | —         |
| `/v1/field`       | ●         | ○     | ○     | —     | —         | —        | —     | —         |
| `/v1/option`      | ●         | ○     | —     | —     | —         | —        | —     | —         |
| `/v1/candidate`   | ●         | ○     | ○     | ○     | ○         | ○        | ○     | ○         |
| `/v1/job`         | ●         | ○     | ○     | ○     | ○         | ○        | ○     | ○         |
| `/v1/client`      | ●         | ○     | ○     | ○     | ○         | ○        | ○     | ○         |
| `/v1/recruiter`   | ●         | ○     | ○     | ○     | ○         | ○        | ○     | ○         |
| `/v1/contact`     | ●         | ○     | ○     | ○     | ○         | ○        | ○     | ○         |
| `/v1/resume`      | ●         | ○     | ○     | ○     | ○         | ○        | ○     | ○         |
| `/v1/process`     | ●         | ○     | ○     | ○     | ○         | ○        | ○     | ○         |
| `/v1/activity`    | ●         | ○     | ○     | ○     | ○         | ○        | ○     | ○         |
| `/v1/contract`    | ●         | ○     | ○     | ○     | ○         | ○        | ○     | ○         |
| `/v1/sales`       | ●         | ○     | ○     | ○     | ○         | ○        | ○     | ○         |
| `/v1/opportunity` | ●         | ○     | ○     | ○     | ○         | ○        | ○     | ○         |
| `/v1/phase`       | ●         | ○     | ○     | ○     | ○         | —        | ○     | —         |
| `/v1/attachment`  | ●         | ○     | ○     | —     | —         | —        | —     | —         |

**`/v1/partition` が `partition` を取らないのは誤記ではない** — Partition を探すための Read なので、
自分が探す値を要求しない。**`/v1/option` に `start` が無い**のも同じく出典どおりで、
この 1 本だけオフセット式のページングができない。

## 表 B — ライブラリが送る Read パラメータ（実装）

**呼び出し側が渡せるものを全部渡したとき**に URL へ載るパラメータ。
検査は各アクセサを実際に呼び、組み立てられた URL のパラメータ集合が下表と**一致する**ことを見る
（載せ忘れも、余分な送信も、どちらも落ちる）。

| エンドポイント    | partition | count | start | field         | condition     | keywords | order | itemstate |
| ----------------- | --------- | ----- | ----- | ------------- | ------------- | -------- | ----- | --------- |
| `/v1/partition`   | —         | 送る  | 送る  | —             | —             | —        | —     | —         |
| `/v1/user`        | 送る      | 送る  | 送る  | 送る          | —             | —        | —     | —         |
| `/v1/field`       | 送る      | 送る  | 送る  | —             | —             | —        | —     | —         |
| `/v1/option`      | 送る      | 送る  | —     | —             | —             | —        | —     | —         |
| `/v1/candidate`   | 送る      | 送る  | 送る  | 送る          | 送る          | 送る     | 送る  | 送る      |
| `/v1/job`         | 送る      | 送る  | 送る  | 送る          | 送る          | 送る     | 送る  | 送る      |
| `/v1/client`      | 送る      | 送る  | 送る  | 送る          | 送る          | 送る     | 送る  | 送る      |
| `/v1/recruiter`   | 送る      | 送る  | 送る  | 送る          | 送る          | 送る     | 送る  | 送る      |
| `/v1/contact`     | 送る      | 送る  | 送る  | 送る          | 送る          | 送る     | 送る  | 送る      |
| `/v1/resume`      | 送る      | 送る  | 送る  | 送る          | 送る          | 送る     | 送る  | 送る      |
| `/v1/process`     | 送る      | 送る  | 送る  | 送る          | 送る          | 送る     | 送る  | 送る      |
| `/v1/activity`    | 送る      | 送る  | 送る  | 送る          | 送る          | 送る     | 送る  | 送る      |
| `/v1/contract`    | 送る      | 送る  | 送る  | 送る          | 送る          | 送る     | 送る  | 送る      |
| `/v1/sales`       | 送る      | 送る  | 送る  | 送る          | 送る          | 送る     | 送る  | 送る      |
| `/v1/opportunity` | 送る      | 送る  | 送る  | 送る          | 送る          | 送る     | 送る  | 送る      |
| `/v1/phase`       | 送る      | 送る  | 送る  | 送る          | 送る          | —        | 送る  | —         |
| `/v1/attachment`  | 送る      | 送る  | 送る  | 送る ⚠️ LV-24 | 送る ⚠️ LV-24 | —        | —     | —         |

**ずれているセルは 2 つ**（どちらも Attachment）。Phase の 2 つは [ADR-0076][adr76] で解消した。

- ~~**Phase の `keywords` / `itemstate`**~~ — **解消**（[ADR-0076][adr76]）。汎用 factory に
  「このエンドポイントは取らないキー」を表す型引数を足し、Phase の公開型から 2 つを外した。
  PORTERS が受け付けるかどうかは未確認のまま（[LV-25][lv]）だが、**既定では送らない**側に倒れた。
- **Attachment の `field` / `condition`** — 出典の Attachment - Read はどちらも挙げていない。
  ライブラリは `field` で本体（`Content`）を取るかどうかを決め（[ADR-0020][adr20]）、
  `get(id)` は `condition` で 1 件に絞る（[ADR-0018][adr18]）。既存の [LV-3][lv] / [LV-4][lv] が
  この 2 つの前提をそのまま指している。

## 表 C — エンドポイント固有の Read パラメータ

共通表に無い、そのエンドポイントだけのパラメータ。

| エンドポイント   | パラメータ     | PORTERS | ライブラリ           | 根拠・備考                                                                 |
| ---------------- | -------------- | ------- | -------------------- | -------------------------------------------------------------------------- |
| `/v1/partition`  | `request_type` | ●       | 送る                 | `requestType`（既定 1 = 到達できる Partition の一覧）                      |
| `/v1/user`       | `request_type` | ●       | 送る                 | `requestType`（既定 1 = 全ユーザー。`current()` は 0）                     |
| `/v1/user`       | `user_type`    | ○       | 送る                 | `userType`（既定 -1 = すべて）                                             |
| `/v1/field`      | `resource`     | ●       | 送る                 | `t.field.of("candidate")` が 1 回束ねる（[ADR-0080][adr80]）               |
| `/v1/field`      | `active`       | ○       | 送る                 | `active`（既定 -1 = すべて）                                               |
| `/v1/option`     | `alias`        | ○       | 送る                 | `alias`                                                                    |
| `/v1/option`     | `level`        | ○       | 送る                 | `level`（既定 -1 = すべての階層）                                          |
| `/v1/option`     | `enabled`      | ○       | 送る                 | `enabled`（既定 -1 = すべて）                                              |
| `/v1/phase`      | `resource`     | ●       | 送る                 | `t.phase.of("client")` が 1 回束ねる（[ADR-0061][adr61] 案2a）             |
| `/v1/phase`      | `resourceId`   | ○       | 送らない ⛔ ADR-0061 | `condition: { ResourceId: … }` で書く（出典も or 検索は condition と言う） |
| `/v1/phase`      | `id`           | ○       | 送らない ⛔ ADR-0061 | 同上。`get(id)` も `condition` で 1 件に絞る                               |
| `/v1/attachment` | `requestType`  | ●       | 送らない ⚠️ LV-24    | 本体を取るかを `field` で決めており、このパラメータを送っていない          |
| `/v1/attachment` | `resource`     | ●       | 送らない ⚠️ LV-24    | 必須と書かれているが送っていない。絞り込みは `condition` で書く            |
| `/v1/attachment` | `resourceId`   | ○       | 送らない ⚠️ LV-3     | `condition: { "ResourceId:eq": "…" }` で書く                               |
| `/v1/attachment` | `id`           | ○       | 送らない ⚠️ LV-3     | `get(id)` は `condition: { "Id:eq": "…" }`                                 |

## 表 D — Read の操作（公開メソッド）

パラメータではなく**呼べるもの**。`get` は「主キーで 1 件取る」の意味で、PORTERS 側に専用の
エンドポイントは無く `condition` で 1 件に絞る。`searchAll` はオフセット式ページングの自動化なので、
`start` を取らないエンドポイントには置けない。

| エンドポイント    | search | searchAll            | get  |
| ----------------- | ------ | -------------------- | ---- |
| `/v1/partition`   | あり   | あり                 | なし |
| `/v1/user`        | あり   | あり                 | なし |
| `/v1/field`       | あり   | あり                 | なし |
| `/v1/option`      | あり   | なし（`start` 無し） | なし |
| `/v1/candidate`   | あり   | あり                 | あり |
| `/v1/job`         | あり   | あり                 | あり |
| `/v1/client`      | あり   | あり                 | あり |
| `/v1/recruiter`   | あり   | あり                 | あり |
| `/v1/contact`     | あり   | あり                 | あり |
| `/v1/resume`      | あり   | あり                 | あり |
| `/v1/process`     | あり   | あり                 | あり |
| `/v1/activity`    | あり   | あり                 | あり |
| `/v1/contract`    | あり   | あり                 | あり |
| `/v1/sales`       | あり   | あり                 | あり |
| `/v1/opportunity` | あり   | あり                 | あり |
| `/v1/phase`       | あり   | あり                 | あり |
| `/v1/attachment`  | あり   | あり                 | あり |

- **マスタ 4 種に `get` が無い**のは [ADR-0022][adr22] の決定（主キー検索の語彙を持たないので、
  `condition` で 1 件に絞る形が作れない）。`t.user.current()` は自己同定で、`get` の代わりではない。
- **`/v1/option` の `searchAll`** は PORTERS 側に `start` が無いので置けない（表 A）。
  ページングの無い Read なので `search` が全件返す。
- **`/v1/attachment` の `searchAll`** は [ADR-0075][adr75] で足した（[RV-45][rv45] は fixed）。
  走査は**メタデータだけ**で、ファイル本体（`Content`）は `get(id)` でしか運ばない — 200 件ぶんの
  本体は V8 の文字列上限を越えて読めないため（根拠と実測は ADR にある）。

## 表 E — Write エンドポイント × 機能

Write が URL で取るのは `partition` だけで、値は本文の XML に載る（[write-format][wf]）。
**削除 API は PORTERS に無い**ので `delete` はどの行にも無い（[削除 API が無いということ][no-delete]）。

| エンドポイント    | partition | create | update | createMany / updateMany |
| ----------------- | --------- | ------ | ------ | ----------------------- |
| `/v1/candidate`   | 送る      | あり   | あり   | あり                    |
| `/v1/job`         | 送る      | あり   | あり   | あり                    |
| `/v1/client`      | 送る      | あり   | あり   | あり                    |
| `/v1/recruiter`   | 送る      | あり   | あり   | あり                    |
| `/v1/contact`     | 送る      | あり   | あり   | あり                    |
| `/v1/resume`      | 送る      | あり   | あり   | あり                    |
| `/v1/process`     | 送る      | あり   | あり   | あり                    |
| `/v1/activity`    | 送る      | あり   | あり   | あり                    |
| `/v1/contract`    | 送る      | あり   | あり   | あり                    |
| `/v1/sales`       | 送る      | あり   | あり   | あり                    |
| `/v1/opportunity` | 送る      | あり   | あり   | あり                    |
| `/v1/phase`       | 送る      | あり   | あり   | あり                    |
| `/v1/attachment`  | 送る      | あり   | あり   | ⛔ ADR-0041             |

- **Attachment の一括**は [ADR-0041][adr41] 軸5 で対象外にした（本体が最大 14MB の Base64 ＝
  1 リクエストが 400 になりやすい）。`create` / `update` は単件で使える。
- **Image 項目を含む一括**も送れない（[ADR-0064][adr64]）。単件の `create` / `update` なら書ける。
- 一括は 200 件ごとに自動で分割して送る（[一括書き込み][bulk-write]）。

## 表 F — Authentication API

`response_type` / `grant_type` ごとに、PORTERS が取るパラメータと、ライブラリのどこがそれを送るか。

| エンドポイント   | 種別            | パラメータ                                              | ライブラリ                         |
| ---------------- | --------------- | ------------------------------------------------------- | ---------------------------------- |
| `GET /v1/oauth`  | `code`          | `app_id` `redirect_url` `response_type` `scope` `state` | `auth.authorizationUrl()`          |
| `GET /v1/oauth`  | `code_direct`   | `app_id` `response_type`                                | 既定のトークン取得（無人）         |
| `GET /v1/oauth`  | `remove`        | `app_id` `redirect_url` `response_type` `scope` `state` | `auth.revokeUrl()`                 |
| `POST /v1/token` | `oauth_code`    | `app_id` `secret` `grant_type` `code`                   | `auth.exchangeAuthorizationCode()` |
| `POST /v1/token` | `refresh_token` | `app_id` `secret` `grant_type` `code`                   | 失効時に自動で更新                 |

- **`state` は渡されたときだけ載る**（任意）。表は「渡したとき」の形を書いている。
- **`code_direct` は `redirect_url` / `scope` を取らない**（出典どおり）。ブラウザを介さないので
  戻り先が無く、権限は事前の `code` 付与で決まっている。
- **Token の値は URL ではなく POST の本文**に載る（App Secret を URL に置かない）。

## 表 G — HTTP ヘッダ

| ヘッダ                       | いつ                  | ライブラリ                                                              |
| ---------------------------- | --------------------- | ----------------------------------------------------------------------- |
| `X-porters-hrbc-oauth-token` | Resource API の全呼出 | 送る                                                                    |
| `X-P-ConnectAPI-Version`     | Resource API の全呼出 | 送る（既定 `2`・[ADR-0042][adr42]）                                     |
| `Content-Type`               | Write ／ Token        | `application/xml; charset=UTF-8` ／ `application/x-www-form-urlencoded` |

---

## この表が測っていないこと

- **項目（フィールド）の網羅**は D4 の担当（[reference ↔ カタログ突合][refcat]）。本書はパラメータと操作だけを見る。
- **値の書式**（Data Type ごとの書き方）は [field-data-types][fdt] と [ADR-0016][adr16] の担当。
- **PORTERS が実際にどう応じるか**は契約後の[ライブ検証][lv]。本書の `⚠️` はすべてそこへ送っている。

[roadmap]: ../roadmap.md
[adr60]: ../adr/0060-full-resource-coverage-direction.md
[adr61]: ../adr/0061-phase-resource-surface.md
[adr76]: ../adr/0076-phase-read-query-surface.md
[adr80]: ../adr/0080-resource-parameter-binding.md
[adr41]: ../adr/0041-bulk-write-surface-impl.md
[adr64]: ../adr/0064-link-image-types.md
[adr42]: ../adr/0042-supported-version-policy.md
[adr20]: ../adr/0020-read-field-default.md
[adr18]: ../adr/0018-attachment-design.md
[adr16]: ../adr/0016-field-type-granularity.md
[rv23]: ../reviews/rv/0023-candidate-catalog-missing-fields.md
[refcat]: ../../test/integration/reference-catalog.test.ts
[adr22]: ../adr/0022-master-read-query-surface.md
[rv45]: ../reviews/rv/0045-attachment-search-all-absent.md
[adr75]: ../adr/0075-attachment-search-all.md
[rapi]: ../usage/reference/resource-api/README.md
[r-partition]: ../usage/reference/resource-api/resources/partition.md
[r-user]: ../usage/reference/resource-api/resources/user.md
[r-field]: ../usage/reference/resource-api/resources/field.md
[r-option]: ../usage/reference/resource-api/resources/option.md
[r-phase]: ../usage/reference/resource-api/resources/phase.md
[r-attachment]: ../usage/reference/resource-api/resources/attachment.md
[wf]: ../usage/reference/resource-api/write-format.md
[fdt]: ../usage/reference/resource-api/field-data-types.md
[no-delete]: ../usage/concepts/no-delete.md
[bulk-write]: ../usage/howto/bulk-write.md
[lv]: ../live-verification.md
