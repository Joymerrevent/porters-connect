# Attachment — フィールド／項目リファレンス

- endpoint: `/v1/attachment`
- scope: `attachment_r / attachment_w`
- alias 接頭辞: `Attachment.`（Candidate は `Person.`、Phase / Attachment は接頭辞なしの短縮名）
- 出典: <https://hrbcapi.porters.jp/hc/ja/articles/115012161328-Attachment-Read>（updated_at 2019-02-01、取得 2026-06-12）

> 記事の主要テーブルを機械抽出したもの（要約・整形済み）。正確な最新は出典を参照。

## カスタム項目

- `Attachment.U_[Name]`（ユーザー作成）/ `Attachment.A_[Name]`（アプリ作成）はテナント毎に異なる。
  上表に無い項目は **Field Read API**（`/v1/field`）で動的に取得する。

## 項目一覧

| Alias       | Name | Field Type | 新規必須 | 更新必須 | 備考                                                                                                                         |
| ----------- | ---- | ---------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Id          | —    | —          | —        | —        | AttachmentのIdです。                                                                                                         |
| Resource    | —    | —          | —        | —        | 関連するResourceを表す項目です。 / Resourceの値は、Resource Listを参照してください。                                         |
| ResourceId  | —    | —          | —        | —        | 関連するResourceのレコードのIdを表します。                                                                                   |
| ContentType | —    | —          | —        | —        | Contentのデータの種類を表します。 / 通常Mime Typeと同じ内容を示します。詳細はAttachment - Mime Type Listを参照してください。 |
| FileName    | —    | —          | —        | —        | Attachmentのファイル名です。                                                                                                 |
| Content     | —    | —          | —        | —        | Base64 Encodeされたファイルです。                                                                                            |
