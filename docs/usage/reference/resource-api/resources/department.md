# Department — フィールド／項目リファレンス

- endpoint: `/v1/department`
- Read scope: `user_r`（**専用の `department_r` は無い** — 出典の Scope 節が挙げるのは `user_r` だけ）
- Write scope: （Write API なし・読み取り専用。[機能拡張のお知らせ][announce] が「Department は read のみ・write は実装していない」と明記）
- 出典: [Department - Field List][src]（updated_at 2026-07-15）／ scope・パラメータ・応答は [Department - Read][read]（updated_at 2026-07-15）より。取得 2026-09-20

> PORTERS Connect API 8.2.1（2025/03）で追加されたマスタ。ユーザー部署型（Link）項目の参照先で、
> `User.P_Department`（System[Department]）が持つ `Department.P_Id` / `Department.P_Name` と同じ部署を指す。
> マスタ系（読み取り専用）。カスタム項目（`U_` / `A_`）は無い（出典「取扱可能な任意の Field はありません」）。
> ライブラリでは `t.department`（`search` / `searchAll`）。6 項目を 1 度に並べて通るかは実機で未確認<!-- 根拠: LV-30 -->。

## Read パラメータ

出典: [Department - Read][read]（Input Variables）。

| 必須 | パラメータ  | 内容                                                                            |
| ---- | ----------- | ------------------------------------------------------------------------------- |
| ●    | `partition` | Partition Id                                                                    |
|      | `count`     | 1〜200。省略時 10                                                               |
|      | `start`     | 0 以上。省略時 0                                                                |
|      | `field`     | 出力項目。省略時は `Department.P_Id` だけ（Connect API 8.2.1 以降で指定できる） |

`condition` / `order` / `keywords` / `itemstate` は取りません（[Resource API 概要][resource-api]）。
User の `request_type` / `user_type` のような絞り込みも無く、Partition 内の部署を全件返すだけです
（`P_Hidden` で非表示の部署を除くのも利用側）。

## 応答

`<Department Total="N" Count="N" Start="N">` ＋ `<Code>` ＋ `<Item>`（Partition / User / Field と同じ
envelope。[Resource API 概要][resource-api]）。出典のサンプル:

```xml
<Department Total="2" Count="2" Start="0">
  <Code>0</Code>
  <Item>
    <Department.P_Id>1</Department.P_Id>
    <Department.P_Name>部署1</Department.P_Name>
  </Item>
  <Item>
    <Department.P_Id>2</Department.P_Id>
    <Department.P_Name>部署2</Department.P_Name>
  </Item>
</Department>
```

## 項目一覧

| Alias                         | Name         | Field Type       | 新規必須 | 更新必須 | 備考                                                     |
| ----------------------------- | ------------ | ---------------- | -------- | -------- | -------------------------------------------------------- |
| Department.P_Id               | ー           | System[Id]       | —        | —        | 部署を判別するためのIDです。                             |
| Department.P_Name             | 部署名       | SinglelineText   | —        | —        | —                                                        |
| Department.P_Hidden           | 非表示       | Number           | —        | —        | Resource APIでのRead時に、参照取得することはできません。 |
| Department.P_SortNo           | ソート順番   | Number           | —        | —        | Resource APIでのRead時に、参照取得することはできません。 |
| Department.P_RegistrationDate | データ登録日 | System[DateTime] | —        | —        | Resource APIでのRead時に、参照取得することはできません。 |
| Department.P_UpdateDate       | データ更新日 | System[DateTime] | —        | —        | Resource APIでのRead時に、参照取得することはできません。 |

「参照取得することはできません」＝ データ系リソースのユーザー部署型項目から `()` で引けるのは
`Department.P_Id` / `Department.P_Name` の 2 つだけ（[機能拡張のお知らせ][announce]）。残る 4 項目は
`/v1/department` を直接 Read したときにだけ出る。

[src]: https://hrbcapi.porters.jp/hc/ja/articles/43490733975577-Department-Field-List
[read]: https://hrbcapi.porters.jp/hc/ja/articles/43464258000793-Department-Read
[announce]: https://hrbcapi.porters.jp/hc/ja/articles/43498624278553
[resource-api]: ../README.md
