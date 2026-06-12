# Opportunity — フィールド／項目リファレンス

- endpoint: `/v1/opportunity`
- Read scope: `opportunity_r, recruiter_r, client_r, user_r, option_r`（＋ 参照する上位リソースの `_r`）
- Write scope: `opportunity_w`
- alias 接頭辞: `Opportunity.`
- 出典: フィールド <https://hrbcapi.porters.jp/hc/ja/articles/21029666049945-Opportunity-Field-List>（updated_at 2023-08-10）／ scope は Read・Write 記事より。取得 2026-06-12

> 記事の主要テーブルを機械抽出したもの（要約・整形済み）。正確な最新は出典を参照。

## カスタム項目

- `Opportunity.U_[Name]`（ユーザー作成）/ `Opportunity.A_[Name]`（アプリ作成）はテナント毎に異なる。
  上表に無い項目は **Field Read API**（`/v1/field`）で動的に取得する。

## 項目一覧

| Alias                          | Name             | Field Type        | 新規必須 | 更新必須 | 備考                                                                                                                                                                          |
| ------------------------------ | ---------------- | ----------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opportunity.P_Id               | 商談管理 ID      | System[Id]        | ●        | ●        | 新規登録時には-1を、更新時には更新対象のIDを指定します。                                                                                                                      |
| Opportunity.P_Owner            | 商談管理の所有者 | User              | ●        | ー       | —                                                                                                                                                                             |
| Opportunity.P_Client           | 企業             | System[Reference] | ●        | ー       | 関連するClient（企業）を表します。 / Readの場合、Client ResourceのFieldを参照することができます。 / Writeの場合、Cliend.P_Idの値のみを指定することができます。                |
| Opportunity.P_Recruiter        | 企業担当者       | System[Reference] | ●        | ー       | 関連するRecruiter（企業担当者）を表します。 / Readの場合、Recruiter ResourceのFieldを参照することができます。 / Writeの場合、Recruiter.P_Idの値のみを指定することができます。 |
| Opportunity.P_RegistrationDate | データ登録日     | System[DateTime]  | ー       | ー       | —                                                                                                                                                                             |
| Opportunity.P_RegisteredBy     | データ登録者     | User              | ー       | ー       | —                                                                                                                                                                             |
| Opportunity.P_UpdateDate       | データ更新日     | System[DateTime]  | ー       | ー       | —                                                                                                                                                                             |
| Opportunity.P_UpdatedBy        | データ更新者     | User              | ー       | ー       | —                                                                                                                                                                             |
| Opportunity.P_Phase            | フェーズ         | Option[Drowdown]  | ー       | ー       | 選択肢：Option.P_OpportunityPhase / 注意事項はWrite API - Phaseの更新についてを参照してください。                                                                             |
| Opportunity.P_PhaseDate        | フェーズ日付     | DateTime          | ー       | ー       | 注意事項はWrite API - Phaseの更新についてを参照してください。                                                                                                                 |
| Opportunity.P_PhaseMemo        | フェーズメモ     | MultilineText     | ー       | ー       | 注意事項はWrite API - Phaseの更新についてを参照してください。                                                                                                                 |
| Opportunity.P_Position         | ポジション       | SinglelineText    | ー       | ー       | —                                                                                                                                                                             |
