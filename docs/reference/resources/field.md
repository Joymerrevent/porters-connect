# Field — フィールド／項目リファレンス

- endpoint: `/v1/field`
- scope: `field_r`
- 出典: <https://hrbcapi.porters.jp/hc/ja/articles/115012160308-Field-Read>（updated_at 2025-03-27、取得 2026-06-12）

> 記事の主要テーブルを機械抽出したもの（要約・整形済み）。正確な最新は出典を参照。
> マスタ系（読み取り専用）。下表は記事の出力値テーブル（envelope を含む）。

## 出力値（レスポンス項目）

| Tag                     | Definition                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field                   | 条件に該当するFieldを含むルート要素です。 / 取得できたデータの数がCountに、取得データのインデックスがStartに設定されます。Startは0から始まるインデックスです。 |
| Total                   | Fieldの属性。指定した検索条件で取得できる総件数を示します。                                                                                                    |
| Count                   | Fieldの属性。今回取得したデータの件数を示します。                                                                                                              |
| Start                   | Fieldの属性。今回取得したデータの開始インデックスを示します。                                                                                                  |
| Code                    | 処理結果を表すcodeです。詳細は、Result Code Listを参照してください。                                                                                           |
| Item                    | 一つのField情報を表します。                                                                                                                                    |
| Field.P_Id              | 項目のIdです                                                                                                                                                   |
| Field.P_Name            | 項目の名称です。                                                                                                                                               |
| Field.P_Alias           | 項目のAliasです。                                                                                                                                              |
| Field.P_Type            | 項目の種類です。 / 詳細はField Type & Data Type Listを参照してください。                                                                                       |
| Field.P_Required        | 項目の必須設定状態を表します。 / 0：通常項目 / 1：入力必須項目                                                                                                 |
| Field.P_Max             | Text Typeの場合は最大文字数を表します。 / Number Typeの場合は最大値を表します。                                                                                |
| Field.P_Min             | Text Typeの場合は最小文字数を表します。 / Number Typeの場合は最小値を表します。                                                                                |
| Field.P_DecimalFraction | Number Typeの場合に、少数以下の桁数を表します。                                                                                                                |
| Field.P_ReferTo         | Option Typeの場合、その項目に関連づけられている選択肢のAliasを表します。 / Reference Typeの場合、参照している上位Resourceの項目のAliasを表します。             |
| Field.P_ResourceType    | Resourceの値です。詳細は、Resource Listを参照してください。                                                                                                    |
