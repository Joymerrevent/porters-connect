# Field Type / Data Type（型システム）

出典: Field Type & Data Type List（updated_at 2026-07-28、取得 2026-06-12・2026-09-20 に差分反映）／
時分型は [Data Type: DateTime（時分型）の追加][time-only]（2026-08-04・PORTERS 9.3.0）。

- <https://hrbcapi.porters.jp/hc/ja/articles/115008017407-Field-Type-Data-Type-List>

各 Field の `Field Type` ごとに `Data Type`（XML 上の表現・値の書式）が決まる。型設計（→ 型設計の ADR-0004）の土台。

## Field Type 一覧

| Value | Field Type          | Data Type          | 値の書式・備考                                                                               |
| ----- | ------------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| 1     | SinglelineText      | SinglelineText     | 一行文字列                                                                                   |
| 2     | MultilineText       | MultilineText      | 改行を含む複数行文字列                                                                       |
| 3     | Number              | Number             | 数値。小数は最大 2 桁（Read）。Write 時、小数第 3 位以下は切り捨て                           |
| 4     | Date                | Date               | `yyyy/mm/dd` のみ                                                                            |
| 5     | Option[Checkbox]    | Option             | 複数選択可。末端 Alias のみ指定                                                              |
| 6     | Option[Radiobutton] | Option             | 単一選択                                                                                     |
| 7     | Option[Dropdown]    | Option             | 単一選択                                                                                     |
| 8     | Age                 | Age                | `yyyy/mm/dd`（値は Date と同じ。画面で年齢を自動算出）                                       |
| 9     | URL                 | URL                | 文字列                                                                                       |
| 10    | Mail                | Mail               | 文字列                                                                                       |
| 11    | System              | System[Id]         | レコード ID（数値）。下記 System Field 参照                                                  |
| —     | System              | System[DateTime]   | `yyyy/mm/dd HH:MM:SS`・**UTC**。**Write 不可**（登録日/更新日）                              |
| —     | System              | System[Reference]  | 上位 Resource 参照。Read は入れ子取得、Write は親の `{Resource}.P_Id` のみ                   |
| —     | System              | System[Department] | `User.P_Department`。参照先は [Department][res-department] マスタ（2025/03 追加）            |
| 12    | DateTime            | DateTime           | `yyyy/mm/dd HH:MM:SS`・**UTC**。**時分型**（2026/08〜）も同じ 12 — 下記「時分型」節          |
| 14    | Currency            | Number             | 通貨（Data Type は Number）                                                                  |
| 15    | Telephone           | Telephone          | 文字列。keyword 検索時はハイフン除去（数字のみ）                                             |
| 16    | Reference           | —                  | 参照表示専用。項目自体は値を持たない                                                         |
| 17    | User                | User               | ユーザー選択。Read は入れ子、**Write は `User.P_Id` のみ**                                   |
| 18    | Image               | Image              | Base64。詳細は [write-format.md][write-format-md] / [Resource API 概要][resource-api-md]     |
| 20    | Link                | Link               | Contact ID / User / [Department][res-department]。**`X-P-ConnectAPI-Version: 2` 以降が必須** |

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

## DateTime の時分型（2026/08・PORTERS 9.3.0）

時刻（時分）だけを持つ項目タイプ。**Field Type は年月日時分型と同じ `12`** で、Field Read の応答からは
**区別できない**（出典が明記。PORTERS のカスタマイズ画面で確かめるしかない）。
`X-P-ConnectAPI-Version` の指定は不要。

| 場面      | 書式・振る舞い                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| 保存      | `1970/01/01` を基準日にした年月日時分（画面の 24:00〜47:59 は `1970/01/02`。例: 26:00 → `1970/01/02 02:00`）             |
| Read      | 年月日時分型と同じ `yyyy/mm/dd HH:MM:SS`（例 `1970/01/01 09:00:00`）。**タイムゾーン変換なし**。`HH:MM` だけの形は出ない |
| Write     | `1970/01/01 HH:MM:SS` または `1970/01/02 HH:MM:SS`。基準日以外は **Code 103**（HTTP は 200）                             |
| condition | 同じ書式で指定。不正な書式は **Code 100** で検索されない（HTTP は 200）                                                  |
| order     | 年月日時分型と同じ                                                                                                       |

**既存連携への影響**（出典の注意）: 管理者が時分型項目を足すと、Field Read 上は年月日時分型に見えるため、
任意の日時を書き込んだ連携が **Code 103** で落ちる。どの項目が時分型かは環境の管理者に確認するしかない。

**このライブラリでの扱い（2026-09-20 時点・未対応）**: ライブラリは FT-12 を UTC の DateTime として
ISO 8601 に正規化する（[ADR-0011][adr11]）。時分型の値をそのまま通すと Read は `1970-01-01T09:00:00Z`
の形で届き（値は欠けない）、Write は **`Z` 付きの ISO** で渡せば `1970/01/01 09:00:00` に戻る。
ただし**オフセット付き（`+09:00` など）で渡すと UTC に換算されて値がずれる**。宣言で時分型と
明示する手段（`defineFields` の builder）は無い → [roadmap][roadmap]（要 ADR）。

## 設計メモ（ライブラリ側の決定）

上の事実に対して、このライブラリがどう決めたか。**いずれも決着済み**です。

- **日時はすべて UTC**・`yyyy/mm/dd HH:MM:SS`（Date は `yyyy/mm/dd`）。ライブラリは境界で
  **ISO 8601（UTC）に正規化**し、**JST など業務タイムゾーンへの変換はしない**（利用側の責務。
  [要件 R-10][prd]／[ADR-0011][adr11]）。
- **参照・User・Link は Write 時 ID のみ**、読み取りは入れ子展開。**型は Read / Write で分けた**
  （`Candidate` と `CandidateUpdateInput`。[ADR-0016][adr16]／[ADR-0019][adr19]）。
- **Link は version 2 必須**。`X-P-ConnectAPI-Version: 2` を**既定で送る**（[ADR-0042][adr42]）。
- `P_RegistrationDate` / `P_UpdateDate` は Write 不可 → **入力型から除外済み**（[ADR-0019][adr19]）。

[write-format-md]: write-format.md
[res-department]: resources/department.md
[time-only]: https://hrbcapi.porters.jp/hc/ja/articles/60022630729497
[roadmap]: ../../../roadmap.md
[prd]: ../../../design/requirements.md
[adr11]: ../../../adr/0011-xml-parse-serialize.md
[adr16]: ../../../adr/0016-field-type-granularity.md
[adr19]: ../../../adr/0019-static-resource-types.md
[adr42]: ../../../adr/0042-supported-version-policy.md
[resource-api-md]: README.md
