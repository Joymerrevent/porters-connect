# Field Type / Data Type（型システム）

出典: Field Type & Data Type List（updated_at 2025-03-05、取得 2026-06-12）。

- <https://hrbcapi.porters.jp/hc/ja/articles/115008017407-Field-Type-Data-Type-List>

各 Field の `Field Type` ごとに `Data Type`（XML 上の表現・値の書式）が決まる。型設計（→ 型設計の ADR-0004）の土台。

## Field Type 一覧

| Value | Field Type          | Data Type          | 値の書式・備考                                                                           |
| ----- | ------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| 1     | SinglelineText      | SinglelineText     | 一行文字列                                                                               |
| 2     | MultilineText       | MultilineText      | 改行を含む複数行文字列                                                                   |
| 3     | Number              | Number             | 数値。小数は最大 2 桁（Read）。Write 時、小数第 3 位以下は切り捨て                       |
| 4     | Date                | Date               | `yyyy/mm/dd` のみ                                                                        |
| 5     | Option[Checkbox]    | Option             | 複数選択可。末端 Alias のみ指定                                                          |
| 6     | Option[Radiobutton] | Option             | 単一選択                                                                                 |
| 7     | Option[Dropdown]    | Option             | 単一選択                                                                                 |
| 8     | Age                 | Age                | `yyyy/mm/dd`（値は Date と同じ。画面で年齢を自動算出）                                   |
| 9     | URL                 | URL                | 文字列                                                                                   |
| 10    | Mail                | Mail               | 文字列                                                                                   |
| 11    | System              | System[Id]         | レコード ID（数値）。下記 System Field 参照                                              |
| —     | System              | System[DateTime]   | `yyyy/mm/dd HH:MM:SS`・**UTC**。**Write 不可**（登録日/更新日）                          |
| —     | System              | System[Reference]  | 上位 Resource 参照。Read は入れ子取得、Write は親の `{Resource}.P_Id` のみ               |
| —     | System              | System[Department] | User API 専用                                                                            |
| 12    | DateTime            | DateTime           | `yyyy/mm/dd HH:MM:SS`・**UTC**                                                           |
| 14    | Currency            | Number             | 通貨（Data Type は Number）                                                              |
| 15    | Telephone           | Telephone          | 文字列。keyword 検索時はハイフン除去（数字のみ）                                         |
| 16    | Reference           | —                  | 参照表示専用。項目自体は値を持たない                                                     |
| 17    | User                | User               | ユーザー選択。Read は入れ子、**Write は `User.P_Id` のみ**                               |
| 18    | Image               | Image              | Base64。詳細は [write-format.md][write-format-md] / [Resource API 概要][resource-api-md] |
| 20    | Link                | Link               | Contact ID / User / Department。**`X-P-ConnectAPI-Version: 2` 以降が必須**               |

## System / User / Reference 系 Field（System Field List）

`{Resource}` は Client / Job / Resume などのリソース名。

| Field Type         | Field                                            | 振る舞い                                                                |
| ------------------ | ------------------------------------------------ | ----------------------------------------------------------------------- |
| System[Id]         | `{Resource}.P_Id`                                | レコード ID。新規 Write は `-1`、更新は対象 ID                          |
| System[DateTime]   | `{Resource}.P_RegistrationDate` / `P_UpdateDate` | 登録日 / 更新日。**Write で任意指定不可**                               |
| System[Reference]  | `{Resource}.P_Client`                            | 関連 Client。Write は `Client.P_Id`                                     |
| System[Reference]  | `{Resource}.P_Recruiter`                         | 関連 Recruiter。Write は `Recruiter.P_Id`                               |
| System[Reference]  | `{Resource}.P_Job`                               | 関連 Job。Write は `Job.P_Id`                                           |
| System[Reference]  | `{Resource}.P_Candidate`                         | 関連 Candidate。**Write は `Person.P_Id`**（Candidate 接頭辞は Person） |
| System[Reference]  | `{Resource}.P_Resume`                            | 関連 Resume。Write は `Resume.P_Id`                                     |
| System[Reference]  | `Sales.P_Contract`                               | 関連 Contract。Write は `Contract.P_Id`                                 |
| System[Reference]  | `Activity.P_ResourceId`                          | 関連する上位 Resource                                                   |
| System[Department] | `User.P_Department`                              | ユーザー部署                                                            |
| User               | `{Resource}.P_Owner`                             | 所有者。**新規作成時は通常必須**                                        |
| User               | `{Resource}.P_RegisteredBy` / `P_UpdatedBy`      | 登録者 / 更新者。Write 省略時はアクセス中のアプリユーザーを自動割当     |
| User               | `Activity.P_EventParticipants`                   | アクティビティ参加者                                                    |

## 設計メモ

- **日時はすべて UTC**・`yyyy/mm/dd HH:MM:SS`（Date は `yyyy/mm/dd`）。JST 運用は境界で +9h 補正（→ 日時の ADR）。
- **参照・User・Link は Write 時 ID のみ**。読み取りは入れ子展開。型表現を Read/Write で分けるか検討（→ 型設計の ADR-0004）。
- **Link は version 2 必須**。既定で `X-P-ConnectAPI-Version: 2` を送る方針（→ HTTP トランスポートの ADR）。
- `P_RegistrationDate` / `P_UpdateDate` は Write 不可 → 入力型から除外できる。

[write-format-md]: write-format.md
[resource-api-md]: README.md
