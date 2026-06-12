# Partition — フィールド／項目リファレンス

- endpoint: `/v1/partition`
- scope: `partition_r`
- 出典: <https://hrbcapi.porters.jp/hc/ja/articles/115012006227-Partition-Read>（updated_at 2025-12-11、取得 2026-06-12）

> 記事の主要テーブルを機械抽出したもの（要約・整形済み）。正確な最新は出典を参照。
> マスタ系（読み取り専用）。下表は記事の出力値テーブル（envelope を含む）。

## 出力値（レスポンス項目）

| Tag                   | Description                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Partition             | 条件に該当するPartitionを含むルート要素です。 / 取得できたデータの数がCountに、取得データのインデックスがStartに設定されます。Startは0から始まるインデックスです。 |
| Total                 | Partitionの属性。指定した検索条件で取得できる総件数を示します。                                                                                                    |
| Count                 | Partitionの属性。今回取得したデータの件数を示します。                                                                                                              |
| Start                 | Partitionの属性。今回取得したデータの開始インデックスを示します。                                                                                                  |
| Code                  | 処理結果を表すcodeです。詳細は、Result Code Listを参照してください。                                                                                               |
| Item                  | 一つのPartition情報を表します。                                                                                                                                    |
| Partition.P_Id        | PartitionのIdです。                                                                                                                                                |
| Partition.P_Name      | PORTERS契約企業の会社名です。                                                                                                                                      |
| Partition.P_CompanyId | PORTERS業務画面へのログイン時に利用する会社IDです。                                                                                                                |
