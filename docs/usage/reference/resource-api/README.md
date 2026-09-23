# Resource API（エンドポイント / パラメータ / XML / Result Code / 制限）

Resource API の共通仕様（エンドポイント・Read のパラメータ・XML の形・制限）を引くページです。ライブラリの `search` / `get` /
`create` / `update` は、この上に組んであります。

出典: Read API - Parameter（2026-07-28）/ Read API - XML Format（2025-03-05）/
Request 制限（2026-04-28）/ Candidate - Read（2024-07-29、XML 例）。取得日 2026-06-12（2026-09-20 に再取得・差分反映）。
（Result Code は [result-codes][result-codes]、Write XML は [write-format][write-format] を参照）

- <https://hrbcapi.porters.jp/hc/ja/articles/115008016927-Read-API-Parameter>
- <https://hrbcapi.porters.jp/hc/ja/articles/115008172008-Read-API-XML-Format>
- <https://hrbcapi.porters.jp/hc/ja/articles/29792218928153>
- <https://hrbcapi.porters.jp/hc/ja/articles/115012006487-Candidate-Read>

## エンドポイント

`{METHOD} https://{host}/v1/{resource}`（resource はリソース名の小文字。例 `/v1/candidate`）。
Read は `GET`、Write は `POST`。Read のクエリは URL エンコードが必要。

## Read パラメータ（共通）

| パラメータ  | 必須 | 内容                                                                                 |
| ----------- | ---- | ------------------------------------------------------------------------------------ |
| `partition` | ●    | Partition Id（数値）。Partition Read で取得可能。**Partition Read 自身は取らない**。 |
| `count`     |      | 取得件数 1〜200。**既定 10**（Option Read だけは省略時に全件）。                     |
| `start`     |      | 取得開始インデックス（0 始まり）。                                                   |
| `field`     |      | 出力項目。カンマ区切り。既定は主キー（例 `Person.P_Id`）。                           |
| `condition` |      | 検索条件。カンマ区切りは AND。                                                       |
| `keywords`  |      | キーワード検索。カンマ区切りは AND（OR 不可）。**100 文字まで**。                    |
| `order`     |      | 並び順。`Alias:asc` / `Alias:desc`。                                                 |
| `itemstate` |      | `existing`（既定）/ `deleted` / `all`。削除済みデータの取得制御。                    |

### field の指定

- 基本: `field=Job.P_Id,Job.P_Position`
- 参照型 / ユーザー型は入れ子: `field=Job.P_Client(Client.P_Id,Client.P_Name)`
  - `()` を省くと上位 Resource の **ID のみ**出力。
  - ユーザー型で参照できるのは `User.P_Id` / `P_Type` / `P_Name` / `P_Mail` の 4 つのみ。

### condition の指定

`condition=[Alias]:[suffix]=[value]`。型ごとに suffix が異なる（省略時の既定あり）。

| 対象型                                           | suffix                                               | 既定   |
| ------------------------------------------------ | ---------------------------------------------------- | ------ |
| Number / Currency / DateTime / Date / Age / Id   | `gt` `ge` `eq` `le` `lt`（Phase の Id は `or` も可） | `eq`   |
| Text 系（SinglelineText/Multiline/Tel/Mail/URL） | `full`（完全一致）/ `part`（部分一致）               | `part` |
| Option                                           | `or` / `and`（値はコロン区切り）                     | `or`   |
| Link（ユーザー型/部署型/担当者型）               | `or` / `and`（値は ID のみ）                         | `or`   |

- **時分型**（Field Type 12 のうち時刻だけを持つ項目・2026/08 追加）を condition に書くときは、値に基準日を付ける:
  `1970/01/01 HH:mm:ss`（00:00〜23:59）／ `1970/01/02 HH:mm:ss`（24:00〜47:59）。基準日以外の年月日は
  **Result Code 100 で検索されない**（[field-data-types][field-data-types] の「時分型」節）。
- 上位階層の field を直接 condition に使うのは不可。ただし「紐づく上位 ID が入る項目」で ID 検索は可能
  （例 `condition=Resume.P_Candidate:eq=10008`）。複数 ID や範囲指定は不可。
- `itemstate` が `deleted` / `all` の場合、condition に使えるのは
  `{Resource}.P_Id` / `{Resource}.P_UpdateDate` / `{Resource}.P_UpdatedBy` の 3 種のみ、
  かつ更新日は **90 日以内**（自動で 90 日条件が付く。91 日以上前の更新日を指定すると Result Code 124）。

マスタ 5 種（Partition / User / Field / Option / Department）は**この共通表と受け付けるパラメータが違う**。各リソースの
「Read パラメータ」節を参照（[Partition][res-partition] / [User][res-user] / [Field][res-field] /
[Option][res-option] / [Department][res-department]）。

## Write パラメータ

Write（`POST /v1/{resource}`）が取るパラメータは **`partition` だけ**（必須）で、
値は Read と同じ。項目の値は URL ではなくリクエストボディの XML で送る（[write-format][write-format]）。

## Read レスポンス XML

```xml
<{Resource} Total="N" Count="N" Start="N">
  <Code>0</Code>
  <Item>
    <Alias>value</Alias>
    ...
  </Item>
  ...
</{Resource}>
```

- **ルート要素はリソース名**（`<Candidate>` `<Job>` `<Partition>` …）。総称形ではなく**各リソースの Read 記事すべてに
  実例がある**（Attachment は `<Attachment Total=… >`、Option は属性なしの `<Option>`）。
  ライブラリはこの名前と `<Code>` の**両方**で「PORTERS の応答か」を見分ける<!-- 根拠: ADR-0051 -->。
- `Total`=条件に合う総件数 / `Count`=今回の件数 / `Start`=今回の開始インデックス（**オフセット式ページング**）。
  ※ **Option だけは属性が付かない**<!-- 根拠: ADR-0022 事実5 -->。
- `<Code>` は Result Code（[result-codes][result-codes]）。`<Item>` は 0 件以上。
  **成功応答にも必ず出力される**（`<Code>0`）ため、`<Code>` の有無が envelope かどうかの判定に使える。
- データ型ごとの入れ子:
  - **Option**: `<Field><OptionRoot><OptionAlias><Option.P_Name/><Option.P_Id/></OptionAlias>...</OptionRoot></Field>`
    （末端 Alias のみ。親子関係は出力されない）
  - **System[Reference] / User**: `<Field><Resource><...参照先項目...></Resource></Field>`
  - **Link**: Contact の ID、またはユーザー型/部署型。Contact は名前等を別途 Contact API で取得。
  - **Image**: `FileName` / `ContentType` / `Content`(Base64)。既定は FileName のみ。condition には使えない。

## Result Code（リソース系。認証エラーとは別）

Read は HTTP 200 ＋ ルート直下の `<Code>0` が成功。**Write はルートに `<Code>` を持たず、
`<Item>` ごとの `<Code>` で返る**（[write-format][write-format]）。コード一覧・出る場所・
リトライ方針は [result-codes][result-codes] に分離（認証 API の [認証エラー][errors] と対称。
番号体系が異なるので混同しない）。

## 各種制限（最新: 2026-04-28）

- **1 分あたり Request 上限**: Read **2000** / Write **500**。超過すると強制切断され得る。
- **1 リクエストの処理レコード数**: Read / Write とも **最大 200 件**。超える場合は 200 件ずつ分割。
- **リクエスト全体の長さ**: **約 15000 文字以内**を推奨（将来 16KB 上限を検討中・未確定）。
- 月次クォータ（約 15 万アクセス/月）は契約オプション側の上限（ドキュメントではなく契約条件）。

[result-codes]: result-codes.md
[res-partition]: resources/partition.md
[res-user]: resources/user.md
[res-field]: resources/field.md
[res-option]: resources/option.md
[res-department]: resources/department.md
[field-data-types]: field-data-types.md
[write-format]: write-format.md
[errors]: ../authentication-api/errors.md
