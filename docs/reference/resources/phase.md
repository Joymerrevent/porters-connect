# Phase — フィールド／項目リファレンス

- endpoint: `/v1/phase`
- scope: `phase_r / phase_w`
- alias 接頭辞: `Phase.`（Candidate は `Person.`、Phase は短縮名）
- 出典: <https://hrbcapi.porters.jp/hc/ja/articles/115008171728-Phase-Field-List>（updated_at 2024-10-01、取得 2026-06-12）

> 記事の主要テーブルを機械抽出したもの（要約・整形済み）。正確な最新は出典を参照。
> 固定項目のみ（カスタム項目なし）。

## 項目一覧

| 新規登録時 / 必須 | 更新時 / 必須 | Field Name            | Data Type          | Definition                                                                                                               |
| ----------------- | ------------- | --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| ●                 | ●             | Id                    | System[Id]         | フェーズのIDです。（IDは、Resource毎に連番となります） / 新規登録時には-1を、更新時には更新対象のPhaseのIDを指定します。 |
| ●                 | ●             | Resource              | Number             | 関連するResourceを表す項目です。 / Resourceの値は、Resource Listを参照してください。                                     |
| ●                 | ●             | ResourceId            | Number             | 関連するResourceのレコードのIdを表します。                                                                               |
| ー                | ー            | Phase                 | Option[Drowdown]   | フェーズを表します。 / 注意事項はWrite API - Phaseの更新についてを参照してください。                                     |
| ー                | ー            | Date                  | DateTime           | フェーズ日付を表します。 / 注意事項はWrite API - Phaseの更新についてを参照してください。                                 |
| ー                | ー            | Memo                  | MultilineText      | フェーズメモを表します。 / 注意事項はWrite API - Phaseの更新についてを参照してください。                                 |
| ー                | ー            | Recent                | Number             | フェーズの状況を表します。 / 0：過去フェーズ / 1：最新フェーズ                                                           |
| ー                | ー            | RegistrationDate      | System[DateTime]   | フェーズのデータ登録日です。自動的に登録日時が指定されます。                                                             |
| ー                | ー            | RegisteredBy          | User               | フェーズのデータ登録者です。                                                                                             |
| ー                | ー            | UpdateDate            | System[DateTime]   | フェーズのデータ更新日です。自動的に更新日時が指定されます。                                                             |
| ー                | ー            | UpdatedBy             | User               | フェーズのデータ更新者です。                                                                                             |
| ー                | ー            | OwnerDepartment       | System[Department] | フェーズ履歴に登録されている所有者部署                                                                                   |
| ー                | ー            | Owner                 | User               | フェーズ履歴に登録されている所有者                                                                                       |
| ー                | ー            | JobOwnerDepartment    | System[Department] | ※Process/Sales のみにあります。 / フェーズ履歴に登録されているJOBの所有者部署                                            |
| ー                | ー            | JobOwner              | User               | ※Process/Sales のみにあります。 / フェーズ履歴に登録されているJOBの所有者                                                |
| ー                | ー            | ResumeOwnerDepartment | System[Department] | ※Process/Sales のみにあります。 / フェーズ履歴に登録されているレジュメの所有者部署                                       |
| ー                | ー            | ResumeOwner           | User               | ※Process/Sales のみにあります。 / フェーズ履歴に登録されているレジュメの所有者                                           |
