# Client — フィールド／項目リファレンス

- endpoint: `/v1/client`
- Read scope: `client_r, user_r, option_r`（＋ 参照する上位リソースの `_r`）
- Write scope: `client_w`
- alias 接頭辞: `Client.`
- 出典: [フィールド定義 記事][src]（updated_at 2019-02-01）／ scope は Read・Write 記事より。取得 2026-06-12

> 記事の主要テーブルを機械抽出したもの（要約・整形済み）。正確な最新は出典を参照。

## カスタム項目

- `Client.U_[Name]`（ユーザー作成）/ `Client.A_[Name]`（アプリ作成）はテナント毎に異なる。
  上表に無い項目は **Field Read API**（`/v1/field`）で動的に取得する。

## 項目一覧

| Alias                     | Name           | Field Type       | 新規必須 | 更新必須 | 備考                                                                                                                                                                                                                                                                 |
| ------------------------- | -------------- | ---------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client.P_Id               | 企業 ID        | System[Id]       | ●        | ●        | 新規登録時には-1を、更新時には更新対象のIDを指定します。                                                                                                                                                                                                             |
| Client.P_Owner            | 企業の所有者   | User             | ●        | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_RegistrationDate | データ登録日   | System[DateTime] | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_RegisteredBy     | データ登録者   | User             | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_UpdateDate       | データ更新日   | System[DateTime] | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_UpdatedBy        | データ更新者   | User             | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_Phase            | フェーズ       | Option[Dropdown] | ー       | ー       | 選択肢：Option.P_ClientPhase / 注意事項はWrite API - Phaseの更新についてを参照してください。                                                                                                                                                                         |
| Client.P_PhaseDate        | フェーズ日付   | DateTime         | ー       | ー       | 注意事項はWrite API - Phaseの更新についてを参照してください。                                                                                                                                                                                                        |
| Client.P_PhaseMemo        | フェーズメモ   | MultilineText    | ー       | ー       | 注意事項はWrite API - Phaseの更新についてを参照してください。                                                                                                                                                                                                        |
| Client.P_Name             | 企業名         | SinglelineText   | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_Memo             | メモ           | MultilineText    | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_Country          | 国(企業)       | SinglelineText   | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_Prefecture       | 都道府県(企業) | SinglelineText   | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_City             | 市区郡(企業)   | SinglelineText   | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_Street           | 本社所在地     | MultilineText    | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_Zipcode          | 郵便番号(企業) | SinglelineText   | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_Telephone        | 電話(企業)     | Telephone        | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.P_Fax              | FAX(企業)      | Telephone        | ー       | ー       | —                                                                                                                                                                                                                                                                    |
| Client.U\_[Name]          | ー             | ー               | ー       | ー       | ユーザーが作成した項目です。 / [Name]には、ユーザーが指定した名称またはシステムによって付与された名称が指定されます。                                                                                                                                                |
| Client.A\_[Name]          | ー             | ー               | ー       | ー       | アプリが作成した項目です。 / [Name]には通常アプリによって付与された名称が指定されます。                                                                                                                                                                              |
| Client.P_Deleted          | ー             | ー               | ー       | ー       | レコードの削除状態を表します。 / 0：削除されていないレコード / 1：削除済みのレコード / / ※本fieldは、2018/04/10より利用可能です。 / ※Read時のfield Parameterとしてのみ指定可能です。ConditionやOrderに指定することはできません。 / また、Write時の指定はできません。 |

[src]: https://hrbcapi.porters.jp/hc/ja/articles/115008016807-Client-Field-List
