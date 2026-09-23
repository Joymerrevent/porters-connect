# Partition — フィールド／項目リファレンス

- endpoint: `/v1/partition`
- Read scope: `partition_r`
- Write scope: （Write API なし・読み取り専用）
- 出典: [フィールド定義 記事][src]（updated_at 2026-07-15・本文は 2025-12-11 版から変更なし）／ scope は Read・Write 記事より。取得 2026-06-12（2026-09-20 に再確認）

> 出典記事の主要な表を抜き出して整えたものです。正確な最新は出典を参照してください。
> マスタ系（読み取り専用）。下表は Read 記事の出力項目から抽出。

## Read パラメータ

出典: [Partition - Read][src]（Input Variables）。

| 必須 | パラメータ     | 内容                                                                                                                                                        |
| ---- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ●    | `request_type` | `0` = ログイン中の Partition（**ブラウザ `code` 認証のときだけ**。`code_direct` では Result Code 403）／`1` = そのトークンでアクセスできる Partition の一覧 |
|      | `count`        | 1〜200。省略時 10                                                                                                                                           |
|      | `start`        | 0 以上。省略時 0                                                                                                                                            |

**`partition` を取らない唯一の Read** です（Partition を探すための API なので）。
共通の `field` / `condition` / `order` / `keywords` / `itemstate` も取りません
（[Resource API 概要][resource-api]）。

## 項目一覧

| Alias                 | Name | Field Type | 新規必須 | 更新必須 | 備考                                                |
| --------------------- | ---- | ---------- | -------- | -------- | --------------------------------------------------- |
| Partition.P_Id        | —    | —          | —        | —        | PartitionのIdです。                                 |
| Partition.P_Name      | —    | —          | —        | —        | PORTERS契約企業の会社名です。                       |
| Partition.P_CompanyId | —    | —          | —        | —        | PORTERS業務画面へのログイン時に利用する会社IDです。 |

[src]: https://hrbcapi.porters.jp/hc/ja/articles/115012006227-Partition-Read
[resource-api]: ../README.md
