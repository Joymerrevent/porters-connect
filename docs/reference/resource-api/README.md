# Resource API（エンドポイント / パラメータ / XML / Result Code / 制限）

出典: Read API - Parameter（2025-03-27）/ Read API - XML Format（2025-03-05）/
Request 制限（2026-04-28）/ Candidate - Read（2024-07-29、XML 例）。取得日 2026-06-12。
（Result Code は [result-codes][result-codes]、Write XML は [write-format][write-format] を参照）

- <https://hrbcapi.porters.jp/hc/ja/articles/115008016927-Read-API-Parameter>
- <https://hrbcapi.porters.jp/hc/ja/articles/115008172008-Read-API-XML-Format>
- <https://hrbcapi.porters.jp/hc/ja/articles/29792218928153>
- <https://hrbcapi.porters.jp/hc/ja/articles/115012006487-Candidate-Read>

## エンドポイント

`{METHOD} https://{host}/v1/{resource}`（resource はリソース名の小文字。例 `/v1/candidate`）。
Read は `GET`、Write は `POST`。Read のクエリは URL エンコードが必要。

## Read パラメータ（共通）

| パラメータ  | 必須 | 内容                                                              |
| ----------- | ---- | ----------------------------------------------------------------- |
| `partition` | ●    | Partition Id（数値）。Partition Read で取得可能。                 |
| `count`     |      | 取得件数 1〜200。**既定 10**。                                    |
| `start`     |      | 取得開始インデックス（0 始まり）。                                |
| `field`     |      | 出力項目。カンマ区切り。既定は主キー（例 `Person.P_Id`）。        |
| `condition` |      | 検索条件。カンマ区切りは AND。                                    |
| `keywords`  |      | キーワード検索。カンマ区切りは AND（OR 不可）。**100 文字まで**。 |
| `order`     |      | 並び順。`Alias:asc` / `Alias:desc`。                              |
| `itemstate` |      | `existing`（既定）/ `deleted` / `all`。削除済みデータの取得制御。 |

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

- 上位階層の field を直接 condition に使うのは不可。ただし「紐づく上位 ID が入る項目」で ID 検索は可能
  （例 `condition=Resume.P_Candidate:eq=10008`）。複数 ID や範囲指定は不可。
- `itemstate` が `deleted` / `all` の場合、condition に使えるのは
  `{Resource}.P_Id` / `{Resource}.P_UpdateDate` / `{Resource}.P_UpdatedBy` の 3 種のみ、
  かつ更新日は **90 日以内**（自動で 90 日条件が付く。91 日以前を指定すると Result Code 124）。

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

- `Total`=条件に合う総件数 / `Count`=今回の件数 / `Start`=今回の開始インデックス（**オフセット式ページング**）。
- `<Code>` は Result Code（[result-codes][result-codes]）。`<Item>` は 0 件以上。
- データ型ごとの入れ子:
  - **Option**: `<Field><OptionRoot><OptionAlias><Option.P_Name/><Option.P_Id/></OptionAlias>...</OptionRoot></Field>`
    （末端 Alias のみ。親子関係は出力されない）
  - **System[Reference] / User**: `<Field><Resource><...参照先項目...></Resource></Field>`
  - **Link**: Contact の ID、またはユーザー型/部署型。Contact は名前等を別途 Contact API で取得。
  - **Image**: `FileName` / `ContentType` / `Content`(Base64)。既定は FileName のみ。condition には使えない。

## Result Code（リソース系。認証エラーとは別）

成功は HTTP 200 かつ `<Code>0`。エラーは HTTP 200 以外、または `<Code>` が 0 以外。
コード一覧とリトライ方針は [result-codes][result-codes] に分離（認証 API の
[認証エラー][errors] と対称。番号体系が異なるので混同しない）。

## 各種制限（最新: 2026-04-28）

- **1 分あたり Request 上限**: Read **2000** / Write **500**。超過すると強制切断され得る。
- **1 リクエストの処理レコード数**: Read / Write とも **最大 200 件**。超える場合は 200 件ずつ分割。
- **リクエスト全体の長さ**: **約 15000 文字以内**を推奨（将来 16KB 上限を検討中・未確定）。
  - ※ `SPEC_v1.md` の「32KB で 400」は旧情報。最新値に合わせること。
- 月次クォータ（約 15 万アクセス/月）は契約オプション側の上限（ドキュメントではなく契約条件）。

[result-codes]: result-codes.md
[write-format]: write-format.md
[errors]: ../authentication-api/errors.md
