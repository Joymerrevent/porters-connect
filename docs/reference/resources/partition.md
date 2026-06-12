# Partition — フィールド／項目リファレンス

- endpoint: `/v1/partition`
- Read scope: `partition_r`
- Write scope: （Write API なし・読み取り専用）
- 出典: フィールド <https://hrbcapi.porters.jp/hc/ja/articles/115012006227-Partition-Read>（updated_at 2025-12-11）／ scope は Read・Write 記事より。取得 2026-06-12

> 記事の主要テーブルを機械抽出したもの（要約・整形済み）。正確な最新は出典を参照。
> マスタ系（読み取り専用）。下表は Read 記事の出力項目から抽出。

## 項目一覧

| Alias                 | Name | Field Type | 新規必須 | 更新必須 | 備考                                                |
| --------------------- | ---- | ---------- | -------- | -------- | --------------------------------------------------- |
| Partition.P_Id        | —    | —          | —        | —        | PartitionのIdです。                                 |
| Partition.P_Name      | —    | —          | —        | —        | PORTERS契約企業の会社名です。                       |
| Partition.P_CompanyId | —    | —          | —        | —        | PORTERS業務画面へのログイン時に利用する会社IDです。 |
