# Field — フィールド／項目リファレンス

- endpoint: `/v1/field`
- Read scope: `field_r`
- Write scope: （Write API なし・読み取り専用）
- 出典: [フィールド定義 記事][src]（updated_at 2026-07-15・本文は 2025-03-27 版から変更なし）／ scope は Read・Write 記事より。取得 2026-06-12（2026-09-20 に再確認）

> 出典記事の主要な表を抜き出して整えたものです。正確な最新は出典を参照してください。
> マスタ系（読み取り専用）。下表は Read 記事の出力項目から抽出。

## Read パラメータ

出典: [Field - Read][src]（Input Variables）。

| 必須 | パラメータ  | 内容                                                                    |
| ---- | ----------- | ----------------------------------------------------------------------- |
| ●    | `partition` | Partition Id                                                            |
| ●    | `resource`  | 対象リソースの種別（値は [リソース一覧][resources-list] の `Value` 列） |
|      | `active`    | `-1` すべて（既定）／`0` 未使用の項目／`1` 使用中の項目                 |
|      | `count`     | 1〜200。省略時 10                                                       |
|      | `start`     | 0 以上。省略時 0                                                        |

`field` / `condition` / `order` / `keywords` / `itemstate` は取りません（[Resource API 概要][resource-api]）。
**Field Type が Link の項目を取るには `X-P-ConnectAPI-Version: 2` 以降**が必要です。

## 項目一覧

| Alias                   | Name | Field Type | 新規必須 | 更新必須 | 備考                                                                                                                                               |
| ----------------------- | ---- | ---------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field.P_Id              | —    | —          | —        | —        | 項目のIdです                                                                                                                                       |
| Field.P_Name            | —    | —          | —        | —        | 項目の名称です。                                                                                                                                   |
| Field.P_Alias           | —    | —          | —        | —        | 項目のAliasです。                                                                                                                                  |
| Field.P_Type            | —    | —          | —        | —        | 項目の種類です。 / 詳細はField Type & Data Type Listを参照してください。                                                                           |
| Field.P_Required        | —    | —          | —        | —        | 項目の必須設定状態を表します。 / 0：通常項目 / 1：入力必須項目                                                                                     |
| Field.P_Max             | —    | —          | —        | —        | Text Typeの場合は最大文字数を表します。 / Number Typeの場合は最大値を表します。                                                                    |
| Field.P_Min             | —    | —          | —        | —        | Text Typeの場合は最小文字数を表します。 / Number Typeの場合は最小値を表します。                                                                    |
| Field.P_DecimalFraction | —    | —          | —        | —        | Number Typeの場合に、少数以下の桁数を表します。                                                                                                    |
| Field.P_ReferTo         | —    | —          | —        | —        | Option Typeの場合、その項目に関連づけられている選択肢のAliasを表します。 / Reference Typeの場合、参照している上位Resourceの項目のAliasを表します。 |
| Field.P_ResourceType    | —    | —          | —        | —        | Resourceの値です。詳細は、Resource Listを参照してください。                                                                                        |

[src]: https://hrbcapi.porters.jp/hc/ja/articles/115012160308-Field-Read
[resource-api]: ../README.md
[resources-list]: ../resources-list.md
