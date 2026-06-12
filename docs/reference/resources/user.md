# User — フィールド／項目リファレンス

- endpoint: `/v1/user`
- Read scope: `user_r`
- Write scope: （Write API なし・読み取り専用）
- 出典: フィールド <https://hrbcapi.porters.jp/hc/ja/articles/360001264748-User-Field-List-Timezone-List>（updated_at 2025-02-14）／ scope は Read・Write 記事より。取得 2026-06-12

> 記事の主要テーブルを機械抽出したもの（要約・整形済み）。正確な最新は出典を参照。
> マスタ系（読み取り専用）。下表は Read 記事の出力項目から抽出。

## 項目一覧

| Alias                   | Name               | Field Type         | 新規必須 | 更新必須 | 備考                                                                                                                                                   |
| ----------------------- | ------------------ | ------------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User.P_Id               | ー                 | System[Id]         | —        | —        | ユーザーを判別するためのIDです。                                                                                                                       |
| User.P_Type             | ユーザータイプ     | Number             | —        | —        | PORTERSの[設定]>[ユーザー]で設定する[ユーザータイプ]の種別で、「システム管理者」と「標準ユーザー」が存在します。 / 0：標準ユーザー / 1：システム管理者 |
| User.P_Name             | 氏名               | SinglelineText     | —        | —        | —                                                                                                                                                      |
| User.P_Mail             | メール             | Mail               | —        | —        | ユーザーがPORTERSにログインする際のユーザーIDとしても利用します。                                                                                      |
| User.P_Department       | 部署               | System[Department] | —        | —        | Outputには以下の情報を含みます。 / Department.P_Id：部署のID / Department.P_Name：部署名 / / Resource APIでのRead時に、参照取得することはできません。  |
| User.P_Telephone        | 電話               | Telephone          | —        | —        | Resource APIでのRead時に、参照取得することはできません。                                                                                               |
| User.P_Mobile           | 携帯               | Telephone          | —        | —        | Resource APIでのRead時に、参照取得することはできません。                                                                                               |
| User.P_MobileMail       | 携帯メール         | Mail               | —        | —        | Resource APIでのRead時に、参照取得することはできません。                                                                                               |
| User.P_UserName         | ユーザーネーム     | SinglelineText     | —        | —        | Resource APIでのRead時に、参照取得することはできません。                                                                                               |
| User.P_TimeZone         | タイムゾーン       | SinglelineText     | —        | —        | PORTERSで取り扱うユーザーのタイムゾーンは、Timezone Listをご確認ください。 / Resource APIでのRead時に、参照取得することはできません。                  |
| User.P_Language         | 言語のデフォルト値 | SinglelineText     | —        | —        | Resource APIでのRead時に、参照取得することはできません。                                                                                               |
| User.P_StartDate        | 利用開始日         | Date               | —        | —        | Resource APIでのRead時に、参照取得することはできません。                                                                                               |
| User.P_EndDate          | 利用終了日         | Date               | —        | —        | Resource APIでのRead時に、参照取得することはできません。                                                                                               |
| User.P_RegistrationDate | データ登録日       | System[DateTime]   | —        | —        | Resource APIでのRead時に、参照取得することはできません。                                                                                               |
| User.P_RegisteredBy     | データ登録者       | User               | —        | —        | Resource APIでのRead時に、参照取得することはできません。                                                                                               |
| User.P_UpdateDate       | データ更新日       | System[DateTime]   | —        | —        | Resource APIでのRead時に、参照取得することはできません。                                                                                               |
| User.P_UpdatedBy        | データ更新者       | User               | —        | —        | Resource APIでのRead時に、参照取得することはできません。                                                                                               |
