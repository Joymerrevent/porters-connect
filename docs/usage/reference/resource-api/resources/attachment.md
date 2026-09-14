# Attachment — フィールド／項目リファレンス

- endpoint: `/v1/attachment`
- Read scope: `attachment_r, process_r, resume_r, candidate_r, job_r, recruiter_r, client_r`（＋ 参照する上位リソースの `_r`）
- Write scope: `attachment_w`
- alias 接頭辞: 接頭辞なし（`Id` / `Resource` などの短縮名）
- 出典: [フィールド定義 記事][src]（updated_at 2019-02-01）／ scope は Read・Write 記事より。取得 2026-06-12

> 記事の主要テーブルを機械抽出したもの（要約・整形済み）。正確な最新は出典を参照。
> 固定項目のみ（カスタム項目なし）。

## Read パラメータ

出典: [Attachment - Read][read]（Input Variables）。**共通の Read パラメータ表とは語彙が違う**
（[Resource API 概要][resource-api]）。

| 必須 | パラメータ    | 内容                                                                    |
| ---- | ------------- | ----------------------------------------------------------------------- |
| ●    | `partition`   | Partition Id                                                            |
| ●    | `requestType` | `0` = `<Content>`（Base64 本体）を付ける／`1` = 付けない                |
| ●    | `resource`    | 対象リソースの種別（値は [リソース一覧][resources-list] の `Value` 列） |
|      | `resourceId`  | 紐づくレコードの Id（Candidate の Id、Job の Id など）                  |
|      | `id`          | Attachment の Id                                                        |
|      | `count`       | 1〜200。省略時 10                                                       |
|      | `start`       | 0 以上。省略時 0                                                        |

他リソースとのいちばん大きな違いは、**本体を取るかどうかが `field` ではなく `requestType` で
決まる**ことです。記事は Attachment Read の `field` / `condition` / `order` / `keywords` /
`itemstate` を挙げていません。

## Write パラメータ

`POST /v1/attachment?partition=[value]`。項目はボディの XML に載せます
（[write-format][write-format]）。

## 項目一覧

| Alias       | Name | Field Type | 新規必須 | 更新必須 | 備考                                                                                                                         |
| ----------- | ---- | ---------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Id          | —    | —          | —        | —        | AttachmentのIdです。                                                                                                         |
| Resource    | —    | —          | —        | —        | 関連するResourceを表す項目です。 / Resourceの値は、Resource Listを参照してください。                                         |
| ResourceId  | —    | —          | —        | —        | 関連するResourceのレコードのIdを表します。                                                                                   |
| ContentType | —    | —          | —        | —        | Contentのデータの種類を表します。 / 通常Mime Typeと同じ内容を示します。詳細はAttachment - Mime Type Listを参照してください。 |
| FileName    | —    | —          | —        | —        | Attachmentのファイル名です。                                                                                                 |
| Content     | —    | —          | —        | —        | Base64 Encodeされたファイルです。                                                                                            |

## 対応 MIME タイプ

出典: [Mime Type List][mime]（updated_at 2022-06-13）

| 拡張子 | mimetype                                                                  |
| ------ | ------------------------------------------------------------------------- |
| txt    | text/plain                                                                |
| pdf    | application/pdf                                                           |
| xls    | application/vnd.ms-excel                                                  |
| doc    | application/msword                                                        |
| ppt    | application/vnd.ms-powerpoint                                             |
| xlsx   | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet         |
| docx   | application/vnd.openxmlformats-officedocument.wordprocessingml.document   |
| pptx   | application/vnd.openxmlformats-officedocument.presentationml.presentation |
| html   | text/html                                                                 |
| htm    | text/html                                                                 |
| gif    | image/gif                                                                 |
| jpg    | image/jpeg                                                                |
| jpeg   | image/jpeg                                                                |
| png    | image/png                                                                 |
| bmp    | image/bmp                                                                 |

[src]: https://hrbcapi.porters.jp/hc/ja/articles/115012161328-Attachment-Read
[mime]: https://hrbcapi.porters.jp/hc/ja/articles/215428097-Attachment-Mime-Type-List
[read]: https://hrbcapi.porters.jp/hc/ja/articles/115012161328
[resource-api]: ../README.md
[resources-list]: ../resources-list.md
[write-format]: ../write-format.md
