# Phase — フィールド／項目リファレンス

- endpoint: `/v1/phase`
- Read scope: `phase_r`（＋ 参照する上位リソースの `_r`）
- Write scope: `phase_w`
- alias 接頭辞: 接頭辞なし（`Id` / `Resource` などの短縮名）
- 出典: フィールド <https://hrbcapi.porters.jp/hc/ja/articles/115008171728-Phase-Field-List>（updated_at 2024-10-01）／ scope は Read・Write 記事より。取得 2026-06-12

> 記事の主要テーブルを機械抽出したもの（要約・整形済み）。正確な最新は出典を参照。
> 固定項目のみ（カスタム項目なし）。

## 項目一覧

| Alias                 | Name | Field Type         | 新規必須 | 更新必須 | 備考                                                                                                                     |
| --------------------- | ---- | ------------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Id                    | —    | System[Id]         | ●        | ●        | フェーズのIDです。（IDは、Resource毎に連番となります） / 新規登録時には-1を、更新時には更新対象のPhaseのIDを指定します。 |
| Resource              | —    | Number             | ●        | ●        | 関連するResourceを表す項目です。 / Resourceの値は、Resource Listを参照してください。                                     |
| ResourceId            | —    | Number             | ●        | ●        | 関連するResourceのレコードのIdを表します。                                                                               |
| Phase                 | —    | Option[Drowdown]   | ー       | ー       | フェーズを表します。 / 注意事項はWrite API - Phaseの更新についてを参照してください。                                     |
| Date                  | —    | DateTime           | ー       | ー       | フェーズ日付を表します。 / 注意事項はWrite API - Phaseの更新についてを参照してください。                                 |
| Memo                  | —    | MultilineText      | ー       | ー       | フェーズメモを表します。 / 注意事項はWrite API - Phaseの更新についてを参照してください。                                 |
| Recent                | —    | Number             | ー       | ー       | フェーズの状況を表します。 / 0：過去フェーズ / 1：最新フェーズ                                                           |
| RegistrationDate      | —    | System[DateTime]   | ー       | ー       | フェーズのデータ登録日です。自動的に登録日時が指定されます。                                                             |
| RegisteredBy          | —    | User               | ー       | ー       | フェーズのデータ登録者です。                                                                                             |
| UpdateDate            | —    | System[DateTime]   | ー       | ー       | フェーズのデータ更新日です。自動的に更新日時が指定されます。                                                             |
| UpdatedBy             | —    | User               | ー       | ー       | フェーズのデータ更新者です。                                                                                             |
| OwnerDepartment       | —    | System[Department] | ー       | ー       | フェーズ履歴に登録されている所有者部署                                                                                   |
| Owner                 | —    | User               | ー       | ー       | フェーズ履歴に登録されている所有者                                                                                       |
| JobOwnerDepartment    | —    | System[Department] | ー       | ー       | ※Process/Sales のみにあります。 / フェーズ履歴に登録されているJOBの所有者部署                                            |
| JobOwner              | —    | User               | ー       | ー       | ※Process/Sales のみにあります。 / フェーズ履歴に登録されているJOBの所有者                                                |
| ResumeOwnerDepartment | —    | System[Department] | ー       | ー       | ※Process/Sales のみにあります。 / フェーズ履歴に登録されているレジュメの所有者部署                                       |
| ResumeOwner           | —    | User               | ー       | ー       | ※Process/Sales のみにあります。 / フェーズ履歴に登録されているレジュメの所有者                                           |
