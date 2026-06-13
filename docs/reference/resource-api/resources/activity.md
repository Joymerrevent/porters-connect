# Activity — フィールド／項目リファレンス

- endpoint: `/v1/activity`
- Read scope: `activity_r, client_r, recruiter_r, job_r, candidate_r, resume_r, process_r, sales_r, user_r, option_r`（＋ 参照する上位リソースの `_r`）
- Write scope: `activity_w`
- alias 接頭辞: `Activity.`
- 出典: [フィールド定義 記事][src]（updated_at 2019-02-01）／ scope は Read・Write 記事より。取得 2026-06-12

> 記事の主要テーブルを機械抽出したもの（要約・整形済み）。正確な最新は出典を参照。

## カスタム項目

- `Activity.U_[Name]`（ユーザー作成）/ `Activity.A_[Name]`（アプリ作成）はテナント毎に異なる。
  上表に無い項目は **Field Read API**（`/v1/field`）で動的に取得する。

## 項目一覧

| Alias                        | Name                     | Field Type        | 新規必須 | 更新必須 | 備考                                                                                                                                                                                                                                                                 |
| ---------------------------- | ------------------------ | ----------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity.P_Id                | アクティビティ ID        | System[Id]        | ●        | ●        | 新規登録時には-1を、更新時には更新対象のIDを指定します。                                                                                                                                                                                                             |
| Activity.P_Owner             | アクティビティの所有者   | User              | ●        | ー       | —                                                                                                                                                                                                                                                                    |
| Activity.P_Title             | 件名                     | SinglelineText    | ●        | ー       | —                                                                                                                                                                                                                                                                    |
| Activity.P_RegistrationDate  | データ登録日             | System[DateTime]  | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Activity.P_RegisteredBy      | データ登録者             | User              | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Activity.P_UpdateDate        | データ更新日             | System[DateTime]  | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Activity.P_UpdatedBy         | データ更新者             | User              | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Activity.P_Phase             | フェーズ                 | Option[Drowdown]  | ー       | ー       | 選択肢：Option.P_ActivityPhase / 注意事項はWrite API - Phaseの更新についてを参照してください。                                                                                                                                                                       |
| Activity.P_PhaseDate         | フェーズ日付             | DateTime          | ー       | ー       | 注意事項はWrite API - Phaseの更新についてを参照してください。                                                                                                                                                                                                        |
| Activity.P_PhaseMemo         | フェーズメモ             | MultilineText     | ー       | ー       | 注意事項はWrite API - Phaseの更新についてを参照してください。                                                                                                                                                                                                        |
| Activity.P_Resource          | アクティビティ登録先     | Number            | ー       | ー       | 関連する上位Resourceを表す項目です。 / Resourceの値は、Resource Listを参照してください。                                                                                                                                                                             |
| Activity.P_ResourceId        | アクティビティ登録先名称 | System[Reference] | ー       | ー       | 関連する上位ResourceのレコードのIDを表す項目です。 / Readの場合、上位ResourceのFieldを参照することができます。 / Writeの場合、{Resource}.P_Idの値のみを指定することができます。                                                                                      |
| Activity.P_FromDate          | 日時(From)               | DateTime          | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Activity.P_ToDate            | 日時(To)                 | DateTime          | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Activity.P_Memo              | メモ                     | MultilineText     | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Activity.P_EventParticipants | 参加者                   | User              | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Activity.P_EventResources    | リソース                 | Option[Checbox]   | ー       | ー       | 選択肢：Option.P_EventResources                                                                                                                                                                                                                                      |
| Activity.U\_[Name]           | ー                       | ー                | ー       | ー       | ユーザーが作成した項目です。 / [Name]には、ユーザーが指定した名称またはシステムによって付与された名称が指定されます。                                                                                                                                                |
| Activity.A\_[Name]           | ー                       | ー                | ー       | ー       | アプリが作成した項目です。 / [Name]には通常アプリによって付与された名称が指定されます。                                                                                                                                                                              |
| Activity.P_Deleted           | ー                       | ー                | ー       | ー       | レコードの削除状態を表します。 / 0：削除されていないレコード / 1：削除済みのレコード / / ※本fieldは、2018/04/10より利用可能です。 / ※Read時のfield Parameterとしてのみ指定可能です。ConditionやOrderに指定することはできません。 / また、Write時の指定はできません。 |

[src]: https://hrbcapi.porters.jp/hc/ja/articles/115008016707-Activity-Field-List
